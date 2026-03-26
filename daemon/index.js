import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import { createServer } from "node:http";
import { join, extname, basename } from "node:path";
import { existsSync } from "node:fs";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";

const PORT = parseInt(process.env.PORT || "7272");
const AUTH_DIR = join(process.cwd(), "auth_info");
const MAX_RECONNECT_DELAY = 60000;

const logger = pino({ level: process.env.DEBUG ? "debug" : "warn" });

let sock = null;
let connected = false;
let phoneNumber = null;
let currentQR = null;
let reconnectAttempt = 0;

const pendingMessages = [];

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm", ".3gp"]);
const AUDIO_EXTS = new Set([".mp3", ".ogg", ".m4a", ".wav", ".aac", ".opus"]);

const MIME_MAP = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska", ".webm": "video/webm", ".3gp": "video/3gpp",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
  ".wav": "audio/wav", ".aac": "audio/aac", ".opus": "audio/opus",
  ".pdf": "application/pdf", ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip", ".txt": "text/plain",
};

function buildMessage(payload) {
  const { text, filePath, caption } = payload;

  // text-only message
  if (!filePath) {
    return { text: text || "" };
  }

  const ext = extname(filePath).toLowerCase();
  const fileName = basename(filePath);

  if (IMAGE_EXTS.has(ext)) {
    return { image: { url: filePath }, caption };
  }
  if (VIDEO_EXTS.has(ext)) {
    return { video: { url: filePath }, caption };
  }
  if (AUDIO_EXTS.has(ext)) {
    return { audio: { url: filePath }, mimetype: MIME_MAP[ext] || "audio/mpeg" };
  }
  // everything else as document
  return {
    document: { url: filePath },
    mimetype: MIME_MAP[ext] || "application/octet-stream",
    fileName,
    caption,
  };
}

async function sendMsg(jid, payload) {
  const msg = buildMessage(payload);
  await sock.sendMessage(jid, msg);
  const label = payload.filePath ? basename(payload.filePath) : (payload.text || "").slice(0, 80);
  console.log(`sent: ${label}`);
}

async function flushPending() {
  while (pendingMessages.length > 0 && connected && sock) {
    const { jid, payload } = pendingMessages[0];
    try {
      await sendMsg(jid, payload);
      pendingMessages.shift();
    } catch (err) {
      console.error("failed to flush queued message:", err.message);
      break;
    }
  }
}

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    logger,
    // WhatsApp rejects the hardcoded version in the npm release (405 error).
    // This must be kept in sync — check github.com/WhiskeySockets/Baileys/issues/2376
    version: [2, 3000, 1034074495],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      console.log("\nscan this QR code with WhatsApp:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      connected = true;
      currentQR = null;
      reconnectAttempt = 0;
      phoneNumber = sock.user?.id?.split(":")[0] || sock.user?.id;
      console.log(`connected as ${phoneNumber}`);
      flushPending();
    }

    if (connection === "close") {
      connected = false;
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

      if (reason === DisconnectReason.loggedOut) {
        console.log("logged out — delete auth_info/ and re-scan QR");
        process.exit(1);
      }

      reconnectAttempt++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), MAX_RECONNECT_DELAY);
      console.log(`disconnected (reason ${reason}), reconnecting in ${delay}ms...`);
      setTimeout(startWhatsApp, delay);
    }
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      connected,
      phoneNumber,
      hasQR: !!currentQR,
      pendingMessages: pendingMessages.length,
    }));
    return;
  }

  if (req.method === "GET" && req.url === "/qr") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ qr: currentQR, connected }));
    return;
  }

  if (req.method === "POST" && req.url === "/send") {
    let body = "";
    for await (const chunk of req) body += chunk;

    try {
      const { text, filePath, caption, phoneNumber: targetPhone } = JSON.parse(body);

      if (!text && !filePath) {
        res.writeHead(400);
        res.end("Missing text or filePath");
        return;
      }

      if (filePath && !existsSync(filePath)) {
        res.writeHead(400);
        res.end(`File not found: ${filePath}`);
        return;
      }

      const jid = targetPhone
        ? `${targetPhone.replace(/[^0-9]/g, "")}@s.whatsapp.net`
        : sock?.user?.id;

      if (!jid) {
        res.writeHead(503);
        res.end("WhatsApp not connected and no phone number provided");
        return;
      }

      const payload = { text, filePath, caption };

      if (connected && sock) {
        await sendMsg(jid, payload);
      } else {
        pendingMessages.push({ jid, payload });
        console.log(`queued (offline): ${filePath || text}`);
      }

      res.writeHead(200);
      res.end("ok");
    } catch (err) {
      console.error("send error:", err);
      res.writeHead(500);
      res.end(err.message || "Send failed");
    }
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`daemon listening on http://127.0.0.1:${PORT}`);
  console.log("starting WhatsApp connection...");
});

startWhatsApp();

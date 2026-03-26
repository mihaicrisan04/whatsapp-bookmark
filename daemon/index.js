import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import { createServer } from "node:http";
import { join } from "node:path";
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

// pending messages queue — sent when connection is restored
const pendingMessages = [];

async function flushPending() {
  while (pendingMessages.length > 0 && connected && sock) {
    const { jid, url } = pendingMessages[0];
    try {
      await sock.sendMessage(jid, { text: url });
      pendingMessages.shift();
      console.log(`sent (queued): ${url}`);
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

      // exponential backoff on reconnect
      reconnectAttempt++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), MAX_RECONNECT_DELAY);
      console.log(`disconnected (reason ${reason}), reconnecting in ${delay}ms...`);
      setTimeout(startWhatsApp, delay);
    }
  });
}

// simple HTTP server for the raycast extension to talk to
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
      const { url, phoneNumber: targetPhone } = JSON.parse(body);
      if (!url) {
        res.writeHead(400);
        res.end("Missing url");
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

      if (connected && sock) {
        await sock.sendMessage(jid, { text: url });
        console.log(`sent: ${url}`);
      } else {
        // queue for when connection is restored
        pendingMessages.push({ jid, url });
        console.log(`queued (offline): ${url}`);
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

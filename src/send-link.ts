import { Clipboard, showHUD, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { sendToDaemon } from "./lib/daemon-client";

interface Preferences {
  phoneNumber: string;
  daemonPort: string;
}

export default async function Command() {
  const prefs = getPreferenceValues<Preferences>();
  const port = parseInt(prefs.daemonPort) || 7272;

  const { text } = await Clipboard.read();
  if (!text) {
    await showHUD("Nothing in clipboard");
    return;
  }

  const urlPattern = /https?:\/\/[^\s]+/;
  const match = text.match(urlPattern);
  if (!match) {
    await showHUD("No link found in clipboard");
    return;
  }

  const link = match[0];

  // optimistic — show success immediately, send in background
  await showHUD(`Sent to WhatsApp: ${link}`);
  sendToDaemon(port, link, prefs.phoneNumber).catch(async (err) => {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to send",
      message: err instanceof Error ? err.message : "Is the daemon running?",
    });
  });
}

import { Clipboard, showHUD, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { sendToDaemon } from "./lib/daemon-client";
import { readClipboard, describeContent } from "./lib/clipboard-media";

interface Preferences {
  phoneNumber: string;
  daemonPort: string;
}

export default async function Command() {
  const prefs = getPreferenceValues<Preferences>();
  const port = parseInt(prefs.daemonPort) || 7272;

  const { text, file } = await Clipboard.read();
  const content = readClipboard(text, file);

  if (content.type === "empty") {
    await showHUD("Nothing in clipboard");
    return;
  }

  const label = describeContent(content);
  await showHUD(`Sent to WhatsApp: ${label}`);

  const payload = { phoneNumber: prefs.phoneNumber } as Record<string, string>;

  switch (content.type) {
    case "url":
      payload.text = content.url;
      break;
    case "text":
      payload.text = content.text;
      break;
    case "file":
    case "image":
      payload.filePath = content.filePath;
      break;
  }

  sendToDaemon(port, payload as { text?: string; filePath?: string; phoneNumber: string }).catch(async (err) => {
    await showToast({
      style: Toast.Style.Failure,
      title: "Failed to send",
      message: err instanceof Error ? err.message : "Is the daemon running?",
    });
  });
}

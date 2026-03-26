import { Action, ActionPanel, Clipboard, List, showHUD, showToast, Toast, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { sendToDaemon } from "./lib/daemon-client";

interface Preferences {
  phoneNumber: string;
  daemonPort: string;
}

interface ClipboardLink {
  url: string;
  offset: number;
}

export default function Command() {
  const [links, setLinks] = useState<ClipboardLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const prefs = getPreferenceValues<Preferences>();
  const port = parseInt(prefs.daemonPort) || 7272;

  useEffect(() => {
    async function loadClipboard() {
      const urlPattern = /https?:\/\/[^\s]+/;
      const found: ClipboardLink[] = [];

      for (let offset = 0; offset <= 5; offset++) {
        try {
          const { text } = await Clipboard.read({ offset });
          if (text) {
            const match = text.match(urlPattern);
            if (match) {
              found.push({ url: match[0], offset });
            }
          }
        } catch {
          // offset not available
        }
      }

      setLinks(found);
      setIsLoading(false);
    }
    loadClipboard();
  }, []);

  async function handleSend(link: ClipboardLink) {
    try {
      await sendToDaemon(port, link.url, prefs.phoneNumber);
      await showHUD(`Sent to WhatsApp: ${link.url}`);
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to send",
        message: err instanceof Error ? err.message : "Is the daemon running?",
      });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Pick a link to send to WhatsApp">
      {links.map((link) => (
        <List.Item
          key={link.offset}
          title={link.url}
          subtitle={link.offset === 0 ? "Current" : `${link.offset} ${link.offset === 1 ? "copy" : "copies"} ago`}
          actions={
            <ActionPanel>
              <Action title="Send to WhatsApp" onAction={() => handleSend(link)} />
              <Action.CopyToClipboard title="Copy Link" content={link.url} />
            </ActionPanel>
          }
        />
      ))}
      {!isLoading && links.length === 0 && (
        <List.EmptyView title="No links in clipboard history" description="Copy a URL first" />
      )}
    </List>
  );
}

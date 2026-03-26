import {
  Action,
  ActionPanel,
  Clipboard,
  Icon,
  List,
  showToast,
  Toast,
  getPreferenceValues,
} from "@raycast/api";
import { useEffect, useState, useCallback } from "react";
import { sendToDaemon } from "./lib/daemon-client";
import { readClipboard, describeContent } from "./lib/clipboard-media";

interface Preferences {
  phoneNumber: string;
  daemonPort: string;
}

interface Contact {
  jid: string;
  name: string | null;
  pushName: string | null;
  verifiedName: string | null;
  phone: string;
}

export default function Command() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const prefs = getPreferenceValues<Preferences>();
  const port = parseInt(prefs.daemonPort) || 7272;

  const fetchContacts = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:${port}/contacts?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        setContacts(await res.json());
      }
    } catch {
      // daemon not reachable
    }
    setIsLoading(false);
  }, [port]);

  useEffect(() => {
    fetchContacts(searchText);
  }, [searchText, fetchContacts]);

  async function handleSend(contact: Contact) {
    const clipboard = await Clipboard.read();
    const content = readClipboard(clipboard.text, clipboard.file);

    if (content.type === "empty") {
      await showToast({ style: Toast.Style.Failure, title: "Nothing in clipboard" });
      return;
    }

    const label = describeContent(content);
    const displayName = contact.name || contact.pushName || contact.phone;

    const payload = { phoneNumber: contact.phone } as Record<string, string>;

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

    const toast = await showToast({ style: Toast.Style.Animated, title: `Sending to ${displayName}...` });

    try {
      await sendToDaemon(port, payload as { text?: string; filePath?: string; phoneNumber: string });
      toast.style = Toast.Style.Success;
      toast.title = `Sent to ${displayName}`;
      toast.message = label;
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to send";
      toast.message = err instanceof Error ? err.message : "Is the daemon running?";
    }
  }

  function displayName(c: Contact): string {
    return c.name || c.pushName || c.verifiedName || c.phone;
  }

  function subtitle(c: Contact): string {
    const parts: string[] = [];
    if (c.name && c.pushName && c.name !== c.pushName) parts.push(`~${c.pushName}`);
    parts.push(`+${c.phone}`);
    return parts.join("  ");
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search contacts..."
      onSearchTextChange={setSearchText}
      throttle
    >
      {contacts.map((contact) => (
        <List.Item
          key={contact.jid}
          icon={Icon.Person}
          title={displayName(contact)}
          subtitle={subtitle(contact)}
          accessories={contact.verifiedName ? [{ tag: "business" }] : []}
          actions={
            <ActionPanel>
              <Action title="Send Clipboard to Contact" icon={Icon.Message} onAction={() => handleSend(contact)} />
            </ActionPanel>
          }
        />
      ))}
      {!isLoading && contacts.length === 0 && searchText && (
        <List.EmptyView title="No contacts found" description={`No match for "${searchText}"`} />
      )}
      {!isLoading && contacts.length === 0 && !searchText && (
        <List.EmptyView title="No contacts synced yet" description="Contacts load after the daemon connects. Try again in a moment." />
      )}
    </List>
  );
}

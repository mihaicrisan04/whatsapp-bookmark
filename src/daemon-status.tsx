import { Action, ActionPanel, Detail, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";

interface Preferences {
  phoneNumber: string;
  daemonPort: string;
}

interface DaemonInfo {
  status: "connected" | "disconnected" | "unreachable";
  phoneNumber?: string;
}

export default function Command() {
  const [info, setInfo] = useState<DaemonInfo>({ status: "unreachable" });
  const [isLoading, setIsLoading] = useState(true);
  const prefs = getPreferenceValues<Preferences>();
  const port = parseInt(prefs.daemonPort) || 7272;

  async function checkStatus() {
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:${port}/status`);
      if (res.ok) {
        const data = await res.json();
        setInfo({ status: data.connected ? "connected" : "disconnected", phoneNumber: data.phoneNumber });
      } else {
        setInfo({ status: "unreachable" });
      }
    } catch {
      setInfo({ status: "unreachable" });
    }
    setIsLoading(false);
  }

  useEffect(() => {
    checkStatus();
  }, []);

  const statusEmoji =
    info.status === "connected" ? "🟢" : info.status === "disconnected" ? "🟡" : "🔴";

  const markdown = `
# WhatsApp Daemon Status

**Status:** ${statusEmoji} ${info.status}
${info.phoneNumber ? `**Phone:** ${info.phoneNumber}` : ""}

${info.status === "unreachable" ? "Start the daemon with:\n```bash\ncd daemon && node index.js\n```" : ""}
${info.status === "disconnected" ? "Scan the QR code in the daemon terminal to connect." : ""}
  `.trim();

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action title="Refresh" onAction={checkStatus} />
        </ActionPanel>
      }
    />
  );
}

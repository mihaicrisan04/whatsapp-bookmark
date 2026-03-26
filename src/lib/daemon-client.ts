export async function sendToDaemon(port: number, url: string, phoneNumber: string): Promise<void> {
  const res = await fetch(`http://localhost:${port}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, phoneNumber }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Daemon returned ${res.status}`);
  }
}

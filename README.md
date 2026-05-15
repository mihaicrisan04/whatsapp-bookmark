# whatsapp bookmark

<!-- TODO: replace with the actual demo gif -->
<p align="center">
  <img src="assets/demo.gif" alt="whatsapp bookmark demo" width="700">
</p>

<p align="center">
  a Raycast extension for sending clipboard stuff (links, text, images, files) to WhatsApp — yourself or any contact.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/platform-macOS-lightgrey.svg" alt="macOS">
</p>

## quick start

```bash
git clone https://github.com/mihaicrisan04/whatsapp-bookmark.git
cd whatsapp-bookmark
mise install && mise run install
mise daemon:build
mise daemon:auth     # scan QR with WhatsApp → Linked Devices
mise daemon:enable   # auto-start on login
mise dev
```

then set your phone number (with country code, no `+`) in Raycast preferences.

## commands

- **send to yourself** — clipboard → your number, no UI
- **send to contact** — search a contact, send
- **pick item to send** — pick from last 6 clipboard items
- **whatsapp auth** — show the QR in Raycast
- **whatsapp daemon status** — check if the daemon is alive

## more

- [WIKI.md](WIKI.md) — architecture, mise tasks, troubleshooting, caveats
- [LICENSE](LICENSE) — MIT

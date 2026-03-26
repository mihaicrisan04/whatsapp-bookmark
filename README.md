# WhatsApp Bookmark

a Raycast extension for sending stuff to WhatsApp — links, text, screenshots, files, whatever's on your clipboard. use it to bookmark links to yourself or quickly share things with contacts.

mit license, do whatever you want with it.

## architecture

the project has two parts that talk to each other over HTTP on localhost:

```
┌──────────────────────┐         HTTP localhost:7272         ┌──────────────────────┐
│   Raycast extension  │ ──────────────────────────────────> │   daemon (binary)    │
│                      │  POST /send {text/filePath/phone}   │                      │
│  - reads clipboard   │  GET  /contacts?q=search            │  - Baileys websocket │
│  - detects content   │  GET  /status                       │    to WhatsApp       │
│  - shows UI/toasts   │  GET  /qr                           │  - persists contacts │
│  - short-lived       │ <──────────────────────────────────  │  - always running    │
└──────────────────────┘              JSON responses          └──────────────────────┘
```

**the daemon** is a standalone 64MB binary compiled with Bun. it maintains a persistent WebSocket connection to WhatsApp's servers via [Baileys](https://github.com/WhiskeySockets/Baileys) (a reverse-engineered WhatsApp Web client). it runs in the background via launchd, auto-starts on login, and exposes a tiny HTTP API for the Raycast extension to talk to. contacts are synced from WhatsApp on first auth and persisted to `contacts.json`. images are converted from PNG to JPEG via jimp before sending (WhatsApp treats large PNGs as document attachments).

**the Raycast extension** is a set of commands that read your clipboard, detect what's on it (URL, text, file, screenshot), and send it to the daemon. it's short-lived — runs only while you're using it. screenshots are extracted from the macOS pasteboard via Swift since Raycast's clipboard API doesn't expose raw image data.

**why two parts?** Raycast extensions are short-lived Node.js processes — they run, do their thing, and exit. Baileys needs a persistent WebSocket connection to WhatsApp. so the daemon holds the connection and the extension just makes HTTP calls to it.

## what it sends

- **links** — sent as text messages
- **plain text** — sent as text messages
- **images** (png, jpg, gif, webp) — converted to JPEG and sent as WhatsApp images
- **videos** (mp4, mov, etc.) — sent as WhatsApp videos
- **files** (pdf, docs, zip, anything) — sent as WhatsApp documents
- **clipboard images** (screenshots, copied images) — extracted from macOS pasteboard via Swift, converted to JPEG

## commands

| command | what it does |
|---------|-------------|
| **Send to Yourself** | sends clipboard content to your own number instantly (no UI) |
| **Send to Contact** | search contacts by name, sorted by most recently messaged |
| **Pick Item to Send** | shows last 6 clipboard items, pick one to send |
| **WhatsApp Auth** | shows the QR code inside Raycast for authentication |
| **WhatsApp Daemon Status** | shows if the daemon is running and connected |

## setup

### prerequisites

- macOS
- [Raycast](https://raycast.com)
- [mise](https://mise.jdx.dev/) (recommended) or Node.js 20+ and [Bun](https://bun.sh) 1.3+

### install

```bash
git clone https://github.com/mihaicrisan04/whatsapp-bookmark.git
cd whatsapp-bookmark

# with mise
mise install        # installs node + bun
mise run install    # installs npm dependencies

# without mise
npm install
cd daemon && npm install && cd ..
```

### build the daemon

```bash
mise daemon:build
# or: cd daemon && bun build --compile --minify index.js --outfile whatsapp-bookmark
```

### authenticate with WhatsApp

```bash
mise daemon:auth
```

- scan the QR code with WhatsApp (Settings → Linked Devices → Link a Device)
- wait for `saved X contacts to disk`
- Ctrl+C

### start the Raycast extension

```bash
mise dev
# or: npm run dev
```

open Raycast, search for "Send to Yourself" — it'll ask for your phone number (with country code, no `+`, e.g. `40712345678`) and daemon port (default `7272`).

### auto-start daemon on login

```bash
mise daemon:enable
```

this creates a launchd agent — the daemon starts on login and restarts if it crashes.

```bash
mise daemon:disable   # stop and remove
mise daemon:logs      # tail the logs
```

## mise tasks

```bash
mise daemon          # start the daemon (alias: mise d)
mise daemon:dev      # start with bun runtime (for development)
mise daemon:build    # compile the standalone binary
mise daemon:auth     # fresh auth — wipes everything, shows new QR
mise daemon:enable   # install as login service
mise daemon:disable  # remove login service
mise daemon:logs     # tail daemon logs
mise install         # install all deps
mise dev             # raycast dev mode
mise lint            # lint the extension
```

## troubleshooting

**daemon gives 405 errors / no QR code**
WhatsApp changes their protocol version periodically. update the `version` array in `daemon/index.js` — check [this issue](https://github.com/WhiskeySockets/Baileys/issues/2376) for the latest. rebuild after: `mise daemon:build`

**messages don't appear on my phone**
phone number in Raycast preferences must match your WhatsApp number with country code, no `+`.

**screenshots send as documents instead of images**
this means the PNG→JPEG conversion failed. check that jimp is installed (`cd daemon && npm ls jimp`) and rebuild the binary.

**daemon disconnects often**
normal — Baileys auto-reconnects with exponential backoff. if it says "logged out", run `mise daemon:auth`.

**contacts list is empty**
contacts are synced on first auth. if you skipped the initial sync or it timed out, run `mise daemon:auth` again and wait for `saved X contacts to disk`.

## notes

- **personal use only** — can't be published to the Raycast store
- Baileys reverse-engineers WhatsApp Web which violates Meta's ToS
- ban risk for personal use is very low but not zero
- credentials in `daemon/auth_info/` and contacts in `daemon/contacts.json` — both gitignored
- macOS only (uses Swift for clipboard image extraction, launchd for auto-start)

## license

mit do whatever

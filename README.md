# WhatsApp Bookmark

a Raycast extension that sends clipboard content to yourself on WhatsApp — links, text, images, videos, files. copy anything, fire the command, it lands in your "Message Yourself" chat.

## what it sends

- **links** — sent as text messages
- **plain text** — sent as text messages
- **images** (png, jpg, gif, webp) — sent as WhatsApp images
- **videos** (mp4, mov, etc.) — sent as WhatsApp videos
- **files** (pdf, docs, zip, anything else) — sent as WhatsApp documents
- **clipboard images** (screenshots, copied images) — extracted from pasteboard and sent as images

## how it works

- **daemon** — a standalone binary (compiled with Bun) that maintains a persistent WhatsApp Web connection via [Baileys](https://github.com/WhiskeySockets/Baileys). runs locally, exposes a tiny HTTP API on `localhost:7272`
- **raycast extension** — reads your clipboard, detects content type, and sends it to the daemon

## setup

### prerequisites

- [Raycast](https://raycast.com)
- [mise](https://mise.jdx.dev/) (recommended) — manages node + bun versions via the included `mise.toml`
- or manually: Node.js 20+ and [Bun](https://bun.sh) 1.3+

### install from release (quickest)

1. download the `whatsapp-bookmark` binary from [releases](https://github.com/mihaicrisan04/whatsapp-bookmark/releases)
2. `chmod +x whatsapp-bookmark`
3. run it, scan the QR, you're done

### build from source

```bash
git clone https://github.com/mihaicrisan04/whatsapp-bookmark.git && cd whatsapp-bookmark

# with mise (recommended)
mise install
mise run install
mise daemon:build

# without mise
npm install
cd daemon && npm install
bun build --compile --minify index.js --outfile whatsapp-bookmark
```

### authenticate with WhatsApp

```bash
mise daemon:auth
# or: cd daemon && rm -rf auth_info && ./whatsapp-bookmark
```

- a QR code appears in your terminal (or use the "WhatsApp Auth" command in Raycast to scan from there)
- open WhatsApp on your phone → Settings → Linked Devices → Link a Device
- scan it — you should see `connected as <your-number>`
- credentials are saved in `daemon/auth_info/`, you only scan once

### configure the raycast extension

```bash
npm run dev
```

1. open Raycast, search for "Send to WhatsApp"
2. fill in preferences:
   - **phone number** — your WhatsApp number with country code, no `+` or dashes (e.g. `40712345678`)
   - **daemon port** — leave as `7272` unless you changed it

### auto-start at login (optional)

```bash
mise daemon:enable
```

installs a launchd agent that starts the daemon on login and restarts it if it crashes.

```bash
mise daemon:disable   # remove it
mise daemon:logs      # tail the logs
```

## commands

| command | what it does |
|---------|-------------|
| **Send to WhatsApp** | sends clipboard content instantly (no UI) — detects if it's a link, text, image, or file |
| **Pick Item to Send** | shows your last 6 clipboard items with type tags, pick one to send |
| **WhatsApp Auth** | shows the QR code inside Raycast for authentication |
| **WhatsApp Daemon Status** | shows if the daemon is running and connected |

## daily usage

1. daemon is running (auto-started or `mise daemon`)
2. copy anything — a link, some text, a file, take a screenshot
3. Raycast → "Send to WhatsApp" → done

tip: assign a hotkey in Raycast for "Send to WhatsApp" for one-keystroke sending.

## mise tasks

```bash
mise daemon          # start the daemon (alias: mise d)
mise daemon:dev      # start with bun runtime (for development)
mise daemon:build    # compile the standalone binary
mise daemon:auth     # fresh auth — wipes credentials, shows new QR
mise daemon:enable   # install as login service (auto-builds first)
mise daemon:disable  # remove login service
mise daemon:logs     # tail daemon logs
mise install         # install all deps (extension + daemon)
mise dev             # raycast dev mode
mise lint            # lint the extension
```

## troubleshooting

**daemon gives 405 errors / no QR code**
WhatsApp periodically changes their protocol version. the `version` array in `daemon/index.js` may need updating — check [this issue](https://github.com/WhiskeySockets/Baileys/issues/2376). rebuild after updating: `mise daemon:build`

**messages don't appear on my phone**
make sure the phone number in Raycast preferences matches your actual WhatsApp number (with country code, no `+`).

**daemon disconnects often**
normal — Baileys auto-reconnects with exponential backoff. if it says "logged out", run `mise daemon:auth` to re-scan.

**media fails to send**
WhatsApp limits: images/videos/audio 16MB, documents 100MB. make sure the file isn't too large.

## important notes

- **personal/local use only** — can't be published to the Raycast store
- Baileys reverse-engineers WhatsApp Web, which technically violates WhatsApp's ToS
- ban risk for personal use (sending yourself stuff a few times a day) is very low but not zero
- credentials in `daemon/auth_info/` — keep private, gitignored
- macOS Accessibility permission may be needed for clipboard image extraction

## license

MIT

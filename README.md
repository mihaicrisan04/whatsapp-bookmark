# WhatsApp Bookmark

a Raycast extension that sends links from your clipboard to yourself on WhatsApp. copy a URL, fire the command, it lands in your "Message Yourself" chat.

## how it works

- **daemon** — a standalone binary (compiled with Bun) that maintains a persistent WhatsApp Web connection via [Baileys](https://github.com/WhiskeySockets/Baileys). runs locally, exposes a tiny HTTP API on `localhost:7272`
- **raycast extension** — grabs URLs from your clipboard and sends them to the daemon

## setup

### prerequisites

- [Raycast](https://raycast.com)
- [mise](https://mise.jdx.dev/) (recommended) — manages node + bun versions via the included `mise.toml`
- or manually: Node.js 20+ and [Bun](https://bun.sh) 1.3+

### install

```bash
git clone <repo-url> && cd whatsapp-bookmark

# with mise (recommended)
mise install
mise run install

# without mise
npm install
cd daemon && npm install
```

### build the daemon

```bash
mise daemon:build
# or: cd daemon && bun build --compile --minify index.js --outfile whatsapp-bookmark
```

this compiles everything into a single 64MB binary — no node_modules needed at runtime.

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

1. open Raycast, search for "Send Link to WhatsApp"
2. fill in preferences:
   - **phone number** — your WhatsApp number with country code, no `+` or dashes (e.g. `40712345678`)
   - **daemon port** — leave as `7272` unless you changed it

### auto-start at login (optional)

```bash
mise daemon:enable
```

this installs a launchd agent that starts the daemon on login and restarts it if it crashes.

```bash
mise daemon:disable   # remove it
mise daemon:logs      # tail the logs
```

## commands

| command | what it does |
|---------|-------------|
| **Send Link to WhatsApp** | grabs the top clipboard URL and sends it instantly (no UI) |
| **Pick Link to Send** | shows your last 6 clipboard items that are URLs, pick one |
| **WhatsApp Auth** | shows the QR code inside Raycast for authentication |
| **WhatsApp Daemon Status** | shows if the daemon is running and connected |

## daily usage

1. daemon is running (auto-started or `mise daemon`)
2. copy a URL
3. Raycast → "Send Link" → done

tip: assign a hotkey in Raycast for "Send Link to WhatsApp" for one-keystroke bookmarking.

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
normal — Baileys auto-reconnects. if it says "logged out", run `mise daemon:auth` to re-scan.

## important notes

- **personal/local use only** — can't be published to the Raycast store
- Baileys reverse-engineers WhatsApp Web, which technically violates WhatsApp's ToS
- ban risk for personal use (few links/day to yourself) is very low but not zero
- credentials in `daemon/auth_info/` — keep private, gitignored

## license

MIT

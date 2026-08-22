# Venus CRM (desktop app)

The real Venus CRM website, running in its own native window instead of a
browser tab — same idea as how Slack/Discord ship their web app as a desktop
app. Sign in once and it opens the actual CRM (`OMNIOS_WEB_URL`, defaults to
`https://crm.venusglobaltech.com`) in a window, with no browser bars.

While the employee is clocked in via Venus CRM, this same app also captures
a screenshot at a randomized interval (every 1-3 minutes) and a plain
active/idle signal (never keystrokes/clicks) in the background, disclosed
per company policy — see `PROJECT_STATUS.md` at the repo root and the phase
10/13 plans for the full context on why this exists and what it deliberately
does not do.

This has to be a real installed program rather than just a website: a
browser tab can't silently capture the OS desktop (that's a real security
boundary), so the disclosed-monitoring piece needs an actual app. Once that
app exists anyway, it made sense for it to also just *be* how employees use
the CRM day to day, rather than asking them to install a second thing.

## Requirements

- The Venus CRM backend running and reachable (defaults to
  `http://localhost:4001`; override with the `OMNIOS_API_URL` env var).
- The Venus CRM website reachable (defaults to
  `https://crm.venusglobaltech.com`; override with `OMNIOS_WEB_URL` for
  local dev, e.g. `http://localhost:8081`).
- A Venus CRM account for the employee whose laptop this runs on.

## Running in development

```
npm install
npm start
```

This compiles the TypeScript (`src/` → `dist/`) and launches Electron. On
first run it shows a small sign-in window — use the employee's normal Venus
CRM email/password. After signing in, the real CRM opens in its own window,
and the app also settles into the system tray. Left-click the tray icon to
reopen the window if it's closed/hidden; right-click it for status (signed
in as, clocked-in state, last capture time) and to sign out or quit.

**Note**: this can't be launched from a sandboxed/headless shell that sets
`ELECTRON_RUN_AS_NODE=1` (common in CI/agent sandboxes) — that env var forces
Electron's bundled Node to run in plain-Node compatibility mode, which
disables every Electron API (`app`, `Tray`, `desktopCapturer`, etc.) and the
app will crash on startup. Run it from a normal terminal on an actual
Windows/Mac machine with a desktop session.

## How it behaves

- Signing in hands the same session to the main window's cookie jar, so the
  website loads already signed in instead of asking for credentials a
  second time.
- Closing the main window (the X button) just hides it — monitoring keeps
  running in the background while clocked in, same as closing a Slack
  window doesn't sign you out of Slack. Only "Quit" from the tray menu (or
  Cmd+Q) actually exits the app.
- Launches automatically at OS login (`app.setLoginItemSettings`), so it's
  already running when the workday starts.
- Polls `GET /work-sessions/active` once a minute; only arms the capture and
  activity-ping timers while the employee has an open (clocked-in) work
  session.
- Captures via Electron's `desktopCapturer`, encodes to JPEG in memory, and
  uploads immediately — the buffer is discarded right after a successful
  upload and is never written to a file.
- Reports OS idle-time (`powerMonitor.getSystemIdleTime()`) once a minute --
  a single "seconds since last input" number, never individual key/click
  events -- so the server can derive an active/idle signal.
- If an upload fails (offline, VPN drop, etc.), up to 3 of the most recent
  captures are held in memory and retried on the next successful upload —
  deliberately bounded, and still never falls back to local-disk storage.
- The refresh token is the only thing persisted across restarts, encrypted
  via Electron's `safeStorage` (OS keychain — DPAPI on Windows, Keychain on
  macOS) in the app's userData directory. If encryption isn't available on a
  given machine, the app simply doesn't persist and asks for login again
  next launch, rather than ever writing a token in the clear.
- Sign out from the tray menu to clear the stored token and the main
  window's session, and require a fresh login (e.g. before handing a laptop
  to someone else).

## Building an installer

```
npm run dist:win   # Windows .exe (NSIS) -- needs to run on/for Windows
npm run dist:mac   # macOS .dmg -- needs to run on macOS, and will prompt
                    # the employee once for Screen Recording permission in
                    # System Settings on first launch (an OS-level disclosure
                    # moment on top of the in-app indicator)
```

Neither of these was run as part of building this agent (no macOS available,
and Windows packaging/signing wasn't exercised end-to-end) — `npm start` is
what's been verified. Treat the `electron-builder` config in `package.json`
as a starting point, not a validated release pipeline.

## What's deliberately not here yet

- Real branding art for the tray icon (currently a 1x1 placeholder — swap
  `TRAY_ICON_DATA_URL` in `src/main.ts` for real artwork).
- Code signing / notarization for the built installers.
- Auto-update (so shipping a code change to this app means re-distributing
  a new installer, unlike the website which updates itself on every deploy).
- Linux support.

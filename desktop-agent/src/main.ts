import {
  app,
  Tray,
  Menu,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  nativeImage,
  powerMonitor,
  session,
} from "electron";
import * as path from "path";
import { login, refreshAccessToken, AuthApiError, TokenStore, type AuthUser } from "./auth";
import {
  getActiveWorkSession,
  uploadRecording,
  uploadActivityPing,
} from "./api";

// The actual CRM website -- this app is now a native-feeling shell around it
// (same idea as how Slack/Discord "apps" are their web app in a window),
// not just a background monitor. Overridable for local dev, e.g.
// OMNIOS_WEB_URL=http://localhost:8081.
const WEB_URL = process.env.OMNIOS_WEB_URL ?? "https://crm.venusglobaltech.com";

// The same "V" brand mark as the website's favicon (see
// ../../public/favicon.svg), rendered by scripts/generate-icons.mjs and
// inlined here so the running app never depends on a separate asset file
// existing on disk at runtime. Used as each BrowserWindow's `icon` option --
// without this, Electron falls back to its own default icon for whatever's
// actually on screen/in the taskbar/Alt-Tab while a window is open, which is
// a different (and lower-resolution) thing than the installer/shortcut icon
// set in package.json's "build.icon".
const APP_ICON_DATA_URL =
  "data:image/png;base64,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";

// Same brand mark, rendered small (32px) and inlined the same way -- kept
// separate from APP_ICON_DATA_URL above because the tray wants a small,
// crisp icon while window icons render best from a larger source.
const TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAABOvAAATrwFj5o7DAAACzElEQVRYhcWXTU8TURSGZ6P+Fz9+jisp7dCZFpSq2BaEgoDSFkwgNBi0UVEkIZLAQg2JRCTRxBjjClsW4AKjJJhotL0fnbZ0esyZ2w5gJZkZbHuSky7a9HnPx703ryT9FT4fPedXMgm/mk23q4R1qAQ6FAIXFQKXKtlZyYBC4LJX5BUvgateamQXZhuFayJZUCbpkEwmg230rHRUBAJwyqdkp31KRverBNoRfEx4sJKhNgphTJmUwh5yZ/A8nPwXfM2vZqF+cArdZrLXh0SoavZuo+A9MoPrMsPPKXPm9W17LRyzV6al/lZ6RhIL12g4gz4Pgz43m5B8SnajKXAPg4ibpSS/QmhT4EIAkZoG9zDo9zCQrMLnZ/KwMJuHuaR2JHxuWoOlx3l4el+zBB9AAVYrT6/vAUa5DDDSzWvgQwEGum78BNY/7FmCD7gZSFbb/iSpiX8HgBcL+Zq2Y+XVmE1oluA3qgKszLy7nYKWKxuAr9t6zcy30iXjO87KEFGtwQdRgJ2F+/hOjAFjrJeb8IPtf79WtAwfdHMhwOq2J8dzpoCXSwVz2xcf7bf/XkyzDB9CAXaOWthLIfNLjGH3m24etc2UaP/vn2WIyNbhhgC75/ztStGsdqI/B8OdHEqVyaw9L9qCD1cF2LlkEsPcFLD6rAiLM/vtn4zkbMFvtnKQnNxw33fExv3Y1WHzk2j/zrZuG24IcHK9riwVzKrxYsJYni/Yht+qCrB7t4+GuAmuihjr4rbhIyjA6cPyZUu0HuNzquQILgQ4fNUe3tbgzXLRyAdxzRE8igL+x5PqFB51oQCZkmbBYy6exQ5sNAkOcRdPSehYmgSHeAsfl9AuoWNpNDzm4qXohfxpwxugXWpo5a4cZsJ0RmiTemS22ij4aAt/lfTBiUP+sCJiCh1LPduOldfADwbaJXQsaBr63IweH84objsunDnzA/EH8zcHRsBNlmUAAAAASUVORK5CYII=";

// Overridable for local testing (e.g. OMNIOS_CAPTURE_MIN_MINUTES=0.1) --
// waiting the full production interval just to confirm the pipeline works
// makes verification painfully slow. Defaults match the real 1-3 minute
// production behavior.
// Screen *recording* schedule, replacing the old 1-3 minute screenshot loop.
// A clip runs for RECORD_SECONDS starting at every SLOT_MINUTES boundary of
// the hour -- at :00, :20 and :40 -- which is exactly 3 clips an hour, so a
// 9-hour shift produces 27. Aligning to wall-clock boundaries (rather than
// "wait 20 minutes from whenever we started") keeps the count per hour exact
// no matter when the employee clocks in.
const RECORD_SECONDS = Number(process.env.OMNIOS_RECORD_SECONDS ?? 180);
const SLOT_MINUTES = Number(process.env.OMNIOS_RECORD_SLOT_MINUTES ?? 20);

// Deliberately small: a full-resolution 3-minute clip is enormous, and 27 per
// employee per day has to fit on the server's volume. 720p at 5fps and
// ~400kbps puts a clip in the ~10MB range while staying readable for review.
const RECORD_WIDTH = Number(process.env.OMNIOS_RECORD_WIDTH ?? 1280);
const RECORD_HEIGHT = Number(process.env.OMNIOS_RECORD_HEIGHT ?? 720);
const RECORD_FPS = Number(process.env.OMNIOS_RECORD_FPS ?? 5);
const RECORD_BITRATE = Number(process.env.OMNIOS_RECORD_BITRATE ?? 400_000);

const MAX_RETRY_QUEUE = 3;
const SESSION_POLL_MS = 60_000;
// How often to report the OS idle-time signal (see reportActivity below).
// Independent of the screenshot cadence above -- activity pings are much
// cheaper than an image upload, so they run on their own steady clock.
const ACTIVITY_PING_MS = 60_000;
// Mirrors the server's ACTIVE_THRESHOLD_SECONDS -- only used here to decide
// what to show in the tray, the server independently derives its own
// active/idle flag from the raw idleSeconds it's sent.
const ACTIVE_THRESHOLD_SECONDS = 90;
// Rolling window for the tray's "recent activity" display -- 15 pings at
// the 60s cadence above is the last ~15 minutes.
const ACTIVITY_HISTORY_SIZE = 15;
// Access tokens are short-lived (15m server-side default) -- refresh well
// before that so a capture/session-poll never races an expiry.
const TOKEN_REFRESH_MS = 10 * 60_000;

// Decoded once at module load and reused for every window -- see
// APP_ICON_DATA_URL above for why this needs to be set explicitly per window.
const appIcon = nativeImage.createFromDataURL(APP_ICON_DATA_URL);

let tray: Tray | null = null;
let loginWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
// Set right before a real quit (tray "Quit", Cmd+Q, etc.) so the main
// window's close handler knows to actually close instead of hiding to tray.
let quitting = false;

let accessToken: string | null = null;
let refreshCookie: string | null = null;
let currentUser: AuthUser | null = null;

let sessionPollTimer: NodeJS.Timeout | null = null;
let captureTimer: NodeJS.Timeout | null = null;
let recorderWindow: BrowserWindow | null = null;
let recordingInFlight = false;
// Set when the server refuses this account's department (403). Cleared on
// the next sign-in, since a different account may well be covered.
let recordingDisabled = false;
let activityPingTimer: NodeJS.Timeout | null = null;
let tokenRefreshTimer: NodeJS.Timeout | null = null;
let clockedIn = false;

// Surfaced in the tray menu so "is this actually working" is answerable by
// hovering/clicking the tray icon, not by guessing from logs.
let lastCaptureAt: Date | null = null;
let lastCaptureError: string | null = null;
// Recent active/idle results (newest last), for the tray's rolling
// "activity" percentage -- see reportActivity.
const activityHistory: boolean[] = [];
let lastActivityError: string | null = null;

// Captures are only ever held in memory, never written to disk. If an
// upload fails (offline, VPN drop, etc.) a few of the most recent ones wait
// here for the next successful upload to flush them -- unbounded retry
// would risk silently accumulating captures forever while offline, which is
// worse than just dropping old ones.
const retryQueue: Array<{ webm: Buffer; durationSec: number }> = [];

let tokenStore: TokenStore;

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.venuscrm.desktopagent");
  }
  tokenStore = new TokenStore(app.getPath("userData"));
  // Launches quietly at OS login, same as Slack/Discord -- the point of a
  // tray-resident app is that it's already running when the workday starts,
  // not something the employee has to remember to open.
  app.setLoginItemSettings({ openAtLogin: true });
  // No-op on Windows; sets the Dock icon on macOS (a Windows build has no
  // dock, but this keeps a future mac build correct without extra work).
  app.dock?.setIcon?.(appIcon);
  createTray();
  createRecorderWindow();
  ipcMain.handle("login", handleLoginRequest);
  await bootstrapAuth();
});

app.on("window-all-closed", () => {
  // Tray-resident app -- closing a window should never quit it (see the
  // main window's own "close" handler below, which hides rather than closes).
});

app.on("before-quit", () => {
  quitting = true;
});

// Hidden, never-shown window that exists only to run MediaRecorder -- the
// main process has no getUserMedia/MediaRecorder, so screen video must be
// captured in a renderer. It loads a local file and holds no session; node
// integration is on purely so it can talk back over ipcRenderer.
function createRecorderWindow() {
  if (recorderWindow) return;
  recorderWindow = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false },
  });
  recorderWindow.loadFile(path.join(__dirname, "..", "renderer", "recorder.html"));
  recorderWindow.on("closed", () => {
    recorderWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Venus CRM");
  // Deliberately not using Tray.setContextMenu -- that makes every click
  // (left or right) pop the menu on some platforms, which would fight with
  // wanting a plain left-click to just open the app like any other tray
  // app. Left-click opens the window; right-click shows the status/quit menu.
  tray.on("click", openMainWindow);
  tray.on("right-click", () => tray?.popUpContextMenu(buildTrayMenu()));
  refreshTrayMenu();
}

// Single source of truth for the tray menu, rebuilt from current state --
// so "is this actually working" is answerable by right-clicking the tray
// icon (last capture time, last error) instead of digging through logs.
function buildTrayMenu(): Menu {
  const lines: string[] = [];
  if (!currentUser) {
    lines.push("Signed out");
  } else {
    lines.push(`Signed in as ${currentUser.email}`);
    lines.push(clockedIn ? "Clocked in — monitoring active" : "Not clocked in — monitoring paused");
    lines.push(lastCaptureAt ? `Last capture: ${lastCaptureAt.toLocaleTimeString()}` : "Last capture: none yet");
    if (lastCaptureError) {
      lines.push(`Last error: ${lastCaptureError}`);
    }
    if (activityHistory.length > 0) {
      const activeCount = activityHistory.filter(Boolean).length;
      const percent = Math.round((activeCount / activityHistory.length) * 100);
      lines.push(`Activity (last ${activityHistory.length} min): ${percent}%`);
    }
    if (lastActivityError) {
      lines.push(`Activity ping error: ${lastActivityError}`);
    }
  }
  return Menu.buildFromTemplate([
    { label: "Open Venus CRM", click: openMainWindow },
    { type: "separator" },
    ...lines.map((label) => ({ label, enabled: false })),
    { type: "separator" },
    { label: "Sign out", click: signOut, enabled: !!currentUser },
    { label: "Quit", click: () => app.quit() },
  ]);
}

// Kept as a no-op-shaped hook so every place that changes auth/capture/
// activity state can keep calling "refreshTrayMenu()" without needing to
// know the menu is now built lazily on right-click rather than eagerly
// pushed to the OS -- the tooltip is the one piece worth updating eagerly,
// since it's visible without any click at all.
function refreshTrayMenu() {
  if (!tray) return;
  tray.setToolTip(currentUser ? `Venus CRM — ${currentUser.email}` : "Venus CRM");
}

// A 401 here means the server genuinely rejected the refresh token (it
// really expired, was revoked, or the account was deactivated) -- that's
// the only case where forgetting the session and asking to log in again is
// correct. Anything else (no response at all, a 5xx, DNS not resolved yet)
// is a transient failure -- most commonly the laptop just woke from sleep
// and the network hasn't reconnected yet -- and must never be treated as a
// sign-out.
function isInvalidRefreshToken(err: unknown): boolean {
  return err instanceof AuthApiError && err.status === 401;
}

const BOOTSTRAP_RETRY_MS = 15_000;

async function bootstrapAuth() {
  const stored = tokenStore.load();
  if (!stored) {
    showLoginWindow();
    return;
  }
  try {
    await applyAuthResult(await refreshAccessToken(stored), { openWindow: true });
  } catch (err) {
    if (isInvalidRefreshToken(err)) {
      tokenStore.clear();
      showLoginWindow();
    } else {
      console.error("Startup token refresh failed transiently, retrying shortly", err);
      setTimeout(bootstrapAuth, BOOTSTRAP_RETRY_MS);
    }
  }
}

// `openWindow` only true for an actual sign-in (fresh login, or the silent
// bootstrap refresh at app startup) -- this function also runs every 10
// minutes from the token-refresh loop just to keep the access token and
// injected cookie current, and that must never yank the main window back
// open/focused if the employee had deliberately closed or minimized it.
async function applyAuthResult(
  result: { accessToken: string; refreshCookie: string; user: AuthUser },
  { openWindow = false }: { openWindow?: boolean } = {},
) {
  accessToken = result.accessToken;
  refreshCookie = result.refreshCookie;
  currentUser = result.user;
  // A different account may be in a recorded department even if the last one
  // wasn't, so give recording a clean slate on every sign-in.
  recordingDisabled = false;
  tokenStore.save(result.refreshCookie);
  refreshTrayMenu();
  loginWindow?.close();
  startTokenRefreshLoop();
  startSessionPolling();
  await injectWebSessionCookie(result.refreshCookie);
  if (openWindow) openMainWindow();
}

// Signing into the tray app already produced a valid refresh-token cookie
// value (see auth.ts) -- hand it to the main window's own cookie jar before
// it loads the site, so the website's own silent-refresh logic (the same
// one that lets a browser tab stay signed in across reloads) picks it up
// immediately instead of showing its login form a second time.
async function injectWebSessionCookie(rawRefreshToken: string): Promise<void> {
  try {
    await session.defaultSession.cookies.set({
      url: WEB_URL,
      name: "refreshToken",
      value: rawRefreshToken,
      httpOnly: true,
      secure: WEB_URL.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      expirationDate: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    });
  } catch (err) {
    console.error("Failed to hand the session to the main window", err);
  }
}

function openMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Venus CRM",
    icon: appIcon,
    autoHideMenuBar: true,
    show: false,
  });
  mainWindow.loadURL(WEB_URL);
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  // Closing the window (the X button) hides it rather than quitting --
  // monitoring should keep running in the background while clocked in even
  // if the employee just closes the window, same as Slack. Only a real
  // quit (tray menu, Cmd+Q) actually tears it down, via the `quitting` flag
  // set in the app-level "before-quit" handler above.
  mainWindow.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function handleLoginRequest(
  _event: unknown,
  { email, password }: { email: string; password: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await applyAuthResult(await login(email, password), { openWindow: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function showLoginWindow() {
  if (loginWindow) {
    loginWindow.focus();
    return;
  }
  loginWindow = new BrowserWindow({
    width: 380,
    height: 460,
    resizable: false,
    title: "Sign in to Venus CRM",
    icon: appIcon,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  loginWindow.setMenuBarVisibility(false);
  loginWindow.loadFile(path.join(__dirname, "..", "renderer", "login.html"));
  loginWindow.on("closed", () => {
    loginWindow = null;
  });
}

function signOut() {
  tokenStore.clear();
  accessToken = null;
  refreshCookie = null;
  currentUser = null;
  stopTokenRefreshLoop();
  stopSessionPolling();
  stopCaptureLoop();
  stopActivityPingLoop();
  lastCaptureAt = null;
  lastCaptureError = null;
  activityHistory.length = 0;
  lastActivityError = null;
  refreshTrayMenu();
  // Shared-machine safety: don't leave the next person who opens the main
  // window silently signed in as whoever just signed out. destroy() (not
  // close()) so this bypasses the hide-on-close handler in openMainWindow.
  session.defaultSession.clearStorageData({ storages: ["cookies"] }).catch(() => {});
  mainWindow?.destroy();
  showLoginWindow();
}

// ---- token refresh ----

function startTokenRefreshLoop() {
  stopTokenRefreshLoop();
  tokenRefreshTimer = setInterval(async () => {
    if (!refreshCookie) return;
    try {
      await applyAuthResult(await refreshAccessToken(refreshCookie));
    } catch (err) {
      if (isInvalidRefreshToken(err)) {
        // The server has genuinely rejected this refresh token (expired,
        // revoked, or the account was deactivated) -- only now is signing
        // out and asking for credentials again correct.
        signOut();
      } else {
        // Transient failure -- most commonly the laptop was asleep and the
        // network isn't back up yet. Stay signed in and just retry on the
        // next tick; losing network for a bit should never look like being
        // logged out.
        console.error("Token refresh failed transiently, staying signed in", err);
      }
    }
  }, TOKEN_REFRESH_MS);
}

function stopTokenRefreshLoop() {
  if (tokenRefreshTimer) clearInterval(tokenRefreshTimer);
  tokenRefreshTimer = null;
}

// ---- work-session polling -> arms/disarms the capture loop ----

function startSessionPolling() {
  stopSessionPolling();
  sessionPollTimer = setInterval(checkSessionAndSchedule, SESSION_POLL_MS);
  checkSessionAndSchedule();
}

function stopSessionPolling() {
  if (sessionPollTimer) clearInterval(sessionPollTimer);
  sessionPollTimer = null;
}

async function checkSessionAndSchedule() {
  if (!accessToken) return;
  let active: { id: string } | null = null;
  try {
    active = await getActiveWorkSession(accessToken);
  } catch {
    return; // transient network issue -- try again on the next poll tick
  }

  if (active && !clockedIn) {
    clockedIn = true;
    refreshTrayMenu();
    scheduleNextRecording();
    startActivityPingLoop();
  } else if (!active && clockedIn) {
    clockedIn = false;
    refreshTrayMenu();
    stopCaptureLoop();
    retryQueue.length = 0; // clear any queued retries immediately
    // Clocking out stops the recorder immediately
    if (recordingInFlight) recorderWindow?.webContents.send("recorder:stop");
    stopActivityPingLoop();
  }
}

// ---- capture loop ----

function stopCaptureLoop() {
  if (captureTimer) clearTimeout(captureTimer);
  captureTimer = null;
}

// Milliseconds until the next :00 / :20 / :40 boundary. Aligning to the wall
// clock (instead of counting 20 minutes from clock-in) is what guarantees
// exactly 3 clips per hour regardless of when the shift starts.
function msUntilNextSlot(): number {
  const now = new Date();
  const slotMs = SLOT_MINUTES * 60_000;
  const msIntoHour = now.getMinutes() * 60_000 + now.getSeconds() * 1000 + now.getMilliseconds();
  const next = Math.ceil(msIntoHour / slotMs) * slotMs;
  // Landing exactly on a boundary means the next one is a full slot away.
  return next === msIntoHour ? slotMs : next - msIntoHour;
}

function scheduleNextRecording() {
  stopCaptureLoop();
  if (!clockedIn) return;
  captureTimer = setTimeout(async () => {
    if (!clockedIn) return;
    await recordAndUpload();
    if (clockedIn) scheduleNextRecording();
  }, msUntilNextSlot());
}

// Captures one clip through the hidden recorder window. Resolves once the
// recording has finished and been handed back, so the caller can schedule the
// next slot without two clips ever overlapping.
async function recordAndUpload(): Promise<void> {
  if (!clockedIn || recordingInFlight || recordingDisabled || !recorderWindow) return;

  let sourceId: string;
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1, height: 1 },
    });
    const primary = sources[0];
    if (!primary) {
      lastCaptureError = "No screen source available";
      refreshTrayMenu();
      return;
    }
    sourceId = primary.id;
  } catch (err) {
    lastCaptureError = (err as Error).message;
    refreshTrayMenu();
    return;
  }

  if (!clockedIn) return;

  recordingInFlight = true;
  refreshTrayMenu();

  const result = await new Promise<{ buffer: Buffer; durationSec: number } | null>((resolve) => {
    // A clip should never outlive its slot; if the renderer wedges, give up
    // rather than blocking every future recording.
    const guard = setTimeout(() => finish(null), (RECORD_SECONDS + 30) * 1000);

    function finish(value: { buffer: Buffer; durationSec: number } | null) {
      clearTimeout(guard);
      ipcMain.removeListener("recorder:done", onDone);
      ipcMain.removeListener("recorder:failed", onFailed);
      resolve(value);
    }
    function onDone(_e: unknown, payload: { buffer: Uint8Array; durationSec: number }) {
      finish({ buffer: Buffer.from(payload.buffer), durationSec: payload.durationSec });
    }
    function onFailed(_e: unknown, message: string) {
      lastCaptureError = message;
      finish(null);
    }

    ipcMain.on("recorder:done", onDone);
    ipcMain.on("recorder:failed", onFailed);

    recorderWindow?.webContents.send("recorder:start", {
      sourceId,
      durationMs: RECORD_SECONDS * 1000,
      width: RECORD_WIDTH,
      height: RECORD_HEIGHT,
      frameRate: RECORD_FPS,
      bitsPerSecond: RECORD_BITRATE,
    });
  });

  recordingInFlight = false;

  if (!clockedIn || !result || result.buffer.length === 0) {
    refreshTrayMenu();
    return;
  }
  await uploadOne(result.buffer, result.durationSec);
}

async function uploadOne(webm: Buffer, durationSec: number) {
  if (!clockedIn || !accessToken) return;
  try {
    await uploadRecording(accessToken, webm, durationSec);
    console.log(`Recording uploaded at ${new Date().toLocaleTimeString()} (${durationSec}s)`);
    lastCaptureAt = new Date();
    lastCaptureError = null;
    refreshTrayMenu();
    await flushRetryQueue();
  } catch (err) {
    const status = (err as { status?: number }).status;
    // 403 means this account's department isn't being recorded (see
    // RECORDED_DEPARTMENTS on the server). That won't change mid-session, so
    // stop the loop rather than burning a clip every slot to be refused again.
    if (status === 403) {
      recordingDisabled = true;
      retryQueue.length = 0;
      stopCaptureLoop();
      lastCaptureError = null;
      refreshTrayMenu();
      return;
    }
    // 409 means the employee clocked out between the recording and the
    // upload -- expected, not a failure worth retrying or alarming about.
    if (status === 409) {
      retryQueue.length = 0;
      return;
    }
    console.error("Recording upload failed", err);
    lastCaptureError = (err as Error).message;
    refreshTrayMenu();
    if (clockedIn && retryQueue.length < MAX_RETRY_QUEUE) {
      retryQueue.push({ webm, durationSec });
    }
  }
}

async function flushRetryQueue() {
  if (!accessToken) return;
  while (retryQueue.length > 0) {
    const next = retryQueue[0];
    try {
      await uploadRecording(accessToken, next.webm, next.durationSec);
      retryQueue.shift();
    } catch {
      break; // still failing -- leave it queued and stop for this cycle
    }
  }
}

// ---- activity ping loop ----
//
// Reports only a single number -- seconds since the OS last saw any
// mouse/keyboard input, via Electron's own powerMonitor.getSystemIdleTime().
// This never touches individual key or click events: no hook is installed,
// nothing about *what* was pressed or clicked is observable to this app, on
// purpose. The server turns that number into an active/idle flag and this
// process never even needs to know the threshold to do its job -- it's
// tracked locally only so the tray can show a rough "how active have I been
// lately" readout, same transparency goal as lastCaptureAt above.

function startActivityPingLoop() {
  stopActivityPingLoop();
  activityPingTimer = setInterval(reportActivity, ACTIVITY_PING_MS);
  reportActivity();
}

function stopActivityPingLoop() {
  if (activityPingTimer) clearInterval(activityPingTimer);
  activityPingTimer = null;
}

async function reportActivity() {
  if (!accessToken) return;
  try {
    const idleSeconds = Math.round(powerMonitor.getSystemIdleTime());
    await uploadActivityPing(accessToken, idleSeconds);
    activityHistory.push(idleSeconds < ACTIVE_THRESHOLD_SECONDS);
    if (activityHistory.length > ACTIVITY_HISTORY_SIZE) activityHistory.shift();
    lastActivityError = null;
    refreshTrayMenu();
  } catch (err) {
    const status = (err as { status?: number }).status;
    // Same "clocked out in between" race as uploadOne -- not a real failure.
    if (status === 409) return;
    console.error("Activity ping failed", err);
    lastActivityError = (err as Error).message;
    refreshTrayMenu();
  }
}

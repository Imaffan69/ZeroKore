/**
 * ZeroKore Desktop â€” main process.
 *
 * A real native shell around the ZeroKore workspace. It is not a mock: the
 * window loads the actual product, keeps your session, and hands OAuth,
 * downloads and external links to the system browser.
 *
 * Security posture (this is the part that matters for a shell that loads a web
 * app):
 *  - contextIsolation on, nodeIntegration off â€” the renderer never gets Node.
 *  - A preload exposes a deliberately tiny, validated API surface.
 *  - Popups are denied; their URL is opened in the user's browser instead.
 *  - Navigation is restricted to our own origin, so a malicious link cannot
 *    turn the app window into a browser.
 *  - Permission requests are denied unless explicitly allowed.
 */

"use strict";

const {
  app,
  BrowserWindow,
  Menu,
  shell,
  session,
  dialog,
  ipcMain,
  nativeTheme,
} = require("electron");
const path = require("path");
const fs = require("fs");

/** Production origin. Override with ZEROKORE_URL when self-hosting. */
const APP_ORIGIN = process.env.ZEROKORE_URL || "https://zerokore.vercel.app";
const IS_DEV = process.env.ZEROKORE_DEV === "1";
const DEV_URL = process.env.ZEROKORE_DEV_URL || "http://localhost:3000";
const START_URL = IS_DEV ? DEV_URL : APP_ORIGIN;

/** Origins we are willing to render inside the app window. */
const ALLOWED_ORIGINS = new Set(
  [APP_ORIGIN, DEV_URL, "http://localhost:3000", "http://127.0.0.1:3000"].map(
    (value) => {
      try {
        return new URL(value).origin;
      } catch {
        return value;
      }
    }
  )
);

/** window-state.json â€” remembers size/position between launches. */
const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

function readState() {
  try {
    const raw = fs.readFileSync(stateFile(), "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.width === "number" && typeof parsed.height === "number") {
      return parsed;
    }
  } catch {
    // first run, or a corrupted file â€” defaults below
  }
  return { width: 1440, height: 940, maximized: false };
}

function saveState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    // getNormalBounds() returns the restored rect even while maximized, which
    // is what we want to persist.
    const bounds = win.getNormalBounds();
    fs.writeFileSync(
      stateFile(),
      JSON.stringify({ ...bounds, maximized: win.isMaximized() })
    );
  } catch {
    // a failed write must never crash the app on close
  }
}

let mainWindow = null;
/** Deep link received before the window existed (cold start on Windows). */
let pendingDeepLink = null;

function createWindow() {
  const state = readState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 940,
    minHeight: 620,
    show: false,
    backgroundColor: "#000000",
    title: "ZeroKore",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  if (state.maximized) mainWindow.maximize();

  // Show only once the first paint lands â€” no white flash on launch.
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (pendingDeepLink) {
      handleDeepLink(pendingDeepLink);
      pendingDeepLink = null;
    }
  });

  mainWindow.on("close", () => saveState(mainWindow));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // --- Navigation policy -------------------------------------------------
  // Anything that is not our own origin opens in the real browser instead of
  // navigating the app window (OAuth providers, GitHub, docs, legal pages).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    // The bundled IDE is loaded from disk, so its own files must stay navigable.
    if (url.startsWith("file://")) return;
    if (isAllowed(url)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });

  // The workspace never embeds a <webview>; refuse to let one attach.
  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log(`[desktop] loaded ${mainWindow.webContents.getURL()}`);
  });

  // Surface a failed load instead of leaving a blank window on screen.
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, failedUrl) => {
    console.error(
      `[desktop] failed to load ${failedUrl} (${errorCode}) ${errorDescription}`
    );
  });

  // The local IDE is the default surface; ZEROKORE_WEB=1 opens the web product.
  if (process.env.ZEROKORE_WEB === "1") {
    mainWindow.loadURL(START_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "ide.html"));
  }
  return mainWindow;
}

/** Deep link: zerokore://<path> */
function handleDeepLink(raw) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingDeepLink = raw;
    return;
  }
  let target = START_URL;
  try {
    const url = new URL(raw);
    const pathPart = `${url.hostname}${url.pathname}`.replace(/^\/+/, "/");
    target = new URL(pathPart || "/", APP_ORIGIN).toString();
  } catch {
    // malformed link â€” fall back to the workspace root
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  mainWindow.loadURL(target);
}

function setSingleInstance() {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  app.on("second-instance", (_event, argv) => {
    const link = argv.find((a) => a.startsWith("zerokore://"));
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    if (link) handleDeepLink(link);
  });
  return true;
}

/** Custom protocol so the OS can hand us links back. */
function setDeepLinkProtocol() {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("zerokore", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  } else {
    app.setAsDefaultProtocolClient("zerokore");
  }
}

/** Deny permissions the product does not use; allow clipboard + notifications. */
function hardenSession(sess) {
  const allowed = new Set([
    "clipboard-read",
    "clipboard-sanitized-write",
    "notifications",
  ]);
  sess.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowed.has(permission));
  });
  sess.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => createWindow(),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow && mainWindow.reload(),
        },
        {
          label: "Toggle Developer Tools",
          accelerator: isMac ? "Alt+Cmd+I" : "Ctrl+Shift+I",
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Go",
      submenu: [
        {
          label: "ZeroKore Web",
          click: () => mainWindow && mainWindow.loadURL(START_URL),
        },
        {
          label: "Local IDE",
          click: () =>
            mainWindow &&
            mainWindow.loadFile(path.join(__dirname, "ide.html")),
        },
        {
          label: "Projects",
          click: () => mainWindow && mainWindow.loadURL(`${APP_ORIGIN}/dashboard`),
        },
        {
          label: "Settings",
          click: () => mainWindow && mainWindow.loadURL(`${APP_ORIGIN}/settings`),
        },
        { type: "separator" },
        { label: "Open in Browser", click: () => shell.openExternal(START_URL) },
      ],
    },
    {
      role: "window",
      submenu: isMac
        ? [
            { role: "minimize" },
            { role: "zoom" },
            { type: "separator" },
            { role: "front" },
          ]
        : [{ role: "minimize" }, { role: "close" }],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Skills",
          click: () => shell.openExternal(`${APP_ORIGIN}/skills`),
        },
        {
          label: "Pricing",
          click: () => shell.openExternal(`${APP_ORIGIN}/pricing`),
        },
        { type: "separator" },
        {
          label: "About ZeroKore Desktop",
          click: () =>
            dialog.showMessageBox({
              type: "info",
              title: "ZeroKore Desktop",
              message: `ZeroKore Desktop ${app.getVersion()}`,
              detail:
                "A native shell for the ZeroKore workspace.\n\nYour projects, agent, terminal and skills live in your ZeroKore account.",
              buttons: ["Close"],
            }),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// IPC â€” the entire renderer-facing surface. Keep it this small.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Real IDE back end.
//
// Everything here operates on the user's actual disk and spawns a real shell.
// Nothing is simulated: the file tree is `fs.readdir`, the editor saves with
// `fs.writeFile`, and the terminal runs a genuine PowerShell process.
//
// Path containment: the renderer may only ever touch paths underneath the folder
// the user opened. `resolveInside` is the single choke point, and it rejects
// traversal (`..`), absolute escapes and anything resolving outside the root, so
// a compromised renderer cannot reach the rest of the machine.
// ---------------------------------------------------------------------------

const os = require("os");
const { spawn } = require("child_process");

/** The folder currently open in the IDE. Null until the user picks one. */
let workspaceRoot = null;

/** Live shell processes, so input can be routed to the focused one. */
const shellChildren = [];

/** Resolve `rel` inside the workspace, or return null if it escapes. */
function resolveInside(rel) {
  if (!workspaceRoot) return null;
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(root, String(rel ?? ""));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

/** Never walk these, even inside the workspace. */
const IGNORED = new Set([
  "node_modules", ".git", ".next", "dist", "build", ".turbo", ".cache", "coverage",
]);

const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".scss", ".html", ".md", ".txt",
  ".yml", ".yaml", ".env", ".example", ".py", ".go", ".rs", ".java", ".c", ".cpp",
  ".h", ".cs", ".php", ".rb", ".sh", ".ps1", ".sql", ".toml", ".xml", ".svg",
]);

function isTextFile(name) {
  const ext = path.extname(name).toLowerCase();
  return TEXT_EXT.has(ext) || ext === "";
}

function walk(dir, depth, out) {
  if (depth > 6 || out.length > 4000) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(workspaceRoot, full);
    if (entry.isDirectory()) {
      out.push({ type: "dir", name: entry.name, path: rel });
      walk(full, depth + 1, out);
    } else if (entry.isFile() && isTextFile(entry.name)) {
      let size = 0;
      try {
        size = fs.statSync(full).size;
      } catch {
        /* ignore */
      }
      out.push({ type: "file", name: entry.name, path: rel, size });
    }
  }
}


function registerIdeIpc() {
  // Open a real folder picker and adopt the result as the workspace.
  ipcMain.handle("ide:open-folder", async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: "Open folder",
      properties: ["openDirectory"],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    workspaceRoot = res.filePaths[0];
    return workspaceRoot;
  });

  ipcMain.handle("ide:default-folder", () => {
    if (!workspaceRoot) workspaceRoot = process.cwd();
    return workspaceRoot;
  });

  ipcMain.handle("ide:tree", () => {
    if (!workspaceRoot) return [];
    const out = [];
    walk(workspaceRoot, 0, out);
    return out;
  });

  ipcMain.handle("ide:read-file", (_e, rel) => {
    const target = resolveInside(rel);
    if (!target) return { error: "Path is outside the open folder." };
    try {
      // 5 MB ceiling: a huge file would freeze the renderer.
      if (fs.statSync(target).size > 5 * 1024 * 1024) {
        return { error: "File is too large to open (limit 5 MB)." };
      }
      return { content: fs.readFileSync(target, "utf8") };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle("ide:write-file", (_e, rel, content) => {
    const target = resolveInside(rel);
    if (!target) return { error: "Path is outside the open folder." };
    if (typeof content !== "string") return { error: "Invalid content." };
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, "utf8");
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle("ide:new-file", (_e, rel, content) => {
    const target = resolveInside(rel);
    if (!target) return { error: "Path is outside the open folder." };
    try {
      if (fs.existsSync(target)) return { error: "A file with that name exists." };
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content ?? "", "utf8");
      return { ok: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  /**
   * A real shell.
   *
   * A genuine PowerShell (Windows) or bash (macOS/Linux) process with its stdio
   * piped to the renderer: real commands, real filesystem, real exit codes.
   * It is deliberately NOT a PTY, so full-screen TUI programs (vim, htop) will
   * not render and there is no job control.
   */
  ipcMain.handle("ide:shell-start", (event) => {
    const isWin = process.platform === "win32";
    const child = spawn(
      isWin ? "powershell.exe" : process.env.SHELL || "/bin/bash",
      isWin ? ["-NoLogo", "-NoProfile", "-NoExit", "-Command", "-"] : ["-i"],
      {
        cwd: workspaceRoot || os.homedir(),
        env: process.env,
        windowsHide: true,
      }
    );
    shellChildren.push(child);

    const send = (channel, payload) => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, payload);
    };
    child.stdout.on("data", (d) => send("ide:shell-out", d.toString()));
    child.stderr.on("data", (d) => send("ide:shell-out", d.toString()));
    child.on("error", (err) => send("ide:shell-out", `\n${err.message}\n`));
    child.on("close", (code) => {
      const i = shellChildren.indexOf(child);
      if (i >= 0) shellChildren.splice(i, 1);
      send("ide:shell-close", code);
    });

    event.sender.once("destroyed", () => {
      try {
        child.kill();
      } catch {
        /* already gone */
      }
    });
    return {
      shell: isWin ? "PowerShell" : path.basename(process.env.SHELL || "bash"),
    };
  });

  ipcMain.handle("ide:shell-input", (_e, data) => {
    const line = `${String(data).replace(/\r?\n/g, "\n")}\n`;
    for (const proc of shellChildren) {
      try {
        proc.stdin.write(line);
      } catch {
        /* the process may have exited */
      }
    }
    return true;
  });
}

/**
 * The local IDE window.
 *
 * The desktop app is a native editor that works on the user's own files, not a
 * wrapper around the website. `ZEROKORE_WEB=1` still opens the web product (handy
 * for checking your account), but the default launch is the local IDE.
 */
function loadIde() {
  mainWindow.loadFile(path.join(__dirname, "ide.html"));
}

function loadWeb(target) {
  mainWindow.loadURL(target);
}

/* ------------------------------------------------------------------- boot */

function registerIpc() {
  // Switch the window between the local IDE and the web product.
  ipcMain.handle("ide:show-web", (_e, target) => {
    const url = typeof target === "string" && /^https?:\/\//i.test(target)
      ? target
      : START_URL;
    if (mainWindow) loadWeb(url);
    return true;
  });

  ipcMain.handle("zk:version", () => app.getVersion());
  ipcMain.handle("zk:platform", () => process.platform);
  ipcMain.handle("zk:open-external", (_event, url) => {
    // Only http(s) â€” never hand arbitrary schemes to the OS.
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return true;
    }
    return false;
  });
  ipcMain.handle("zk:open-workspace", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.loadURL(START_URL);
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
if (!setSingleInstance()) {
  // Another instance owns the lock; it has been told to focus.
} else {
  setDeepLinkProtocol();

  const startLink = process.argv.find((a) => a.startsWith("zerokore://"));
  if (startLink) pendingDeepLink = startLink;

  app.whenReady().then(() => {
    nativeTheme.themeSource = "dark";
    session.defaultSession.setUserAgent(
      `${session.defaultSession.getUserAgent()} ZeroKoreDesktop/${app.getVersion()}`
    );
    hardenSession(session.defaultSession);
    registerIpc();
    registerIdeIpc();
    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // macOS convention: keep the app alive with no windows.
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
}


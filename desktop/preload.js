/**
 * ZeroKore Desktop — preload bridge.
 *
 * Runs in an isolated world with `sandbox: true`. The renderer only ever sees
 * the four functions below; there is no `require`, no `process`, and no Node
 * primitive exposed. Every argument is validated in the main process, so a
 * compromised page cannot use this bridge to open arbitrary schemes or read
 * local files.
 */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zerokore", {
  /** True when the page is running inside the desktop shell. */
  isDesktop: true,

  /** Desktop app version. */
  version: () => ipcRenderer.invoke("zk:version"),

  /** 'win32' | 'darwin' | 'linux' — lets the UI adapt shortcuts. */
  platform: () => ipcRenderer.invoke("zk:platform"),

  /**
   * Open an http(s) URL in the user's real browser. Anything else is rejected
   * by the main process, so this cannot be used to launch a local program.
   */
  openExternal: (url) => ipcRenderer.invoke("zk:open-external", String(url)),

  /** Focus (or restore) the app window and return it to the workspace root. */
  openWorkspace: () => ipcRenderer.invoke("zk:open-workspace"),
});

/**
 * The local IDE bridge.
 *
 * Separate from `zerokore` because it is a different trust surface: these calls
 * touch the real filesystem and spawn a real shell. Every path is re-validated
 * in the main process against the folder the user explicitly opened, so the
 * renderer cannot escape it — the bridge exposes no path primitive of its own.
 */
contextBridge.exposeInMainWorld("ide", {
  /** Native folder picker. Resolves to the chosen path, or null if cancelled. */
  openFolder: () => ipcRenderer.invoke("ide:open-folder"),

  /** A starting folder (the app's cwd) when the user has not chosen one yet. */
  defaultFolder: () => ipcRenderer.invoke("ide:default-folder"),

  /** Real directory tree, relative to the open folder. */
  tree: () => ipcRenderer.invoke("ide:tree"),

  /** Read a file (relative path). Resolves { content } or { error }. */
  readFile: (rel) => ipcRenderer.invoke("ide:read-file", String(rel)),

  /** Write a file (relative path). Resolves { ok } or { error }. */
  writeFile: (rel, content) =>
    ipcRenderer.invoke("ide:write-file", String(rel), String(content)),

  /** Create a file (relative path). Resolves { ok } or { error }. */
  newFile: (rel, content) =>
    ipcRenderer.invoke("ide:new-file", String(rel), String(content ?? "")),

  /** Start the real shell. Resolves { shell }. */
  shellStart: () => ipcRenderer.invoke("ide:shell-start"),

  /** Send a command line to the shell. */
  shellInput: (data) => ipcRenderer.invoke("ide:shell-input", String(data)),

  /** Subscribe to shell output. Returns an unsubscribe function. */
  onShellOutput: (cb) => {
    const listener = (_e, data) => cb(String(data));
    ipcRenderer.on("ide:shell-out", listener);
    return () => ipcRenderer.removeListener("ide:shell-out", listener);
  },

  /** Subscribe to shell exit. Returns an unsubscribe function. */
  onShellClose: (cb) => {
    const listener = (_e, code) => cb(code);
    ipcRenderer.on("ide:shell-close", listener);
    return () => ipcRenderer.removeListener("ide:shell-close", listener);
  },
});

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

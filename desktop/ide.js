"use strict";

/**
 * ZeroKore Desktop — local IDE renderer.
 *
 * Every capability here is real and local:
 *   - the file tree is the actual directory listing on disk
 *   - opening, editing and saving go through the main process to `fs`
 *   - the terminal is a live PowerShell/bash process, not a transcript
 *
 * The renderer has no Node access (`contextIsolation`, `sandbox`); it talks to
 * the main process only through the `window.ide` bridge, and every path it
 * sends is re-validated against the folder the user opened.
 */

const ide = window.ide;

const el = {
  tree: document.getElementById("tree"),
  tabs: document.getElementById("tabs"),
  editor: document.getElementById("editor"),
  terminal: document.getElementById("terminal"),
  cmd: document.getElementById("cmd"),
  status: document.getElementById("status"),
  root: document.getElementById("root-label"),
  save: document.getElementById("save"),
  openFolder: document.getElementById("open-folder"),
  refresh: document.getElementById("refresh"),
  clearTerm: document.getElementById("clear-term"),
  shellName: document.getElementById("shell-name"),
};

/** Open files: rel path -> { model, dirty }. */
const open = new Map();
let active = null;
let editor = null;
const history = [];
let historyAt = -1;

function setStatus(text) {
  el.status.textContent = text;
}

function write(text, cls) {
  const span = document.createElement("span");
  if (cls) span.className = cls;
  span.textContent = text;
  el.terminal.appendChild(span);
  el.terminal.scrollTop = el.terminal.scrollHeight;
}

/* ------------------------------------------------------------------ tree */

async function loadTree() {
  const items = await ide.tree();
  el.tree.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "empty folder";
    li.style.opacity = "0.5";
    el.tree.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    const depth = item.path.split(/[\\/]/).length - 1;
    li.style.paddingLeft = `${10 + depth * 12}px`;

    const glyph = document.createElement("span");
    glyph.className = "glyph";
    glyph.textContent = item.type === "dir" ? "▾" : "·";
    li.appendChild(glyph);

    const label = document.createElement("span");
    label.textContent = item.name;
    if (item.type === "dir") label.className = "dir";
    li.appendChild(label);

    if (item.type === "file") {
      li.addEventListener("click", () => void openFile(item.path));
      if (active === item.path) li.classList.add("active");
    }
    el.tree.appendChild(li);
  }
}

/* ---------------------------------------------------------------- editor */

function languageFor(path) {
  const ext = path.split(".").pop().toLowerCase();
  const map = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", css: "css", scss: "scss", html: "html", md: "markdown",
    py: "python", go: "go", rs: "rust", java: "java", c: "c", cpp: "cpp",
    cs: "csharp", php: "php", rb: "ruby", sh: "shell", ps1: "powershell",
    sql: "sql", yml: "yaml", yaml: "yaml", xml: "xml", toml: "ini",
  };
  return map[ext] || "plaintext";
}

function renderTabs() {
  el.tabs.innerHTML = "";
  for (const [path, entry] of open) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab" + (path === active ? " active" : "");
    const name = document.createElement("span");
    name.textContent = path.split(/[\\/]/).pop();
    tab.appendChild(name);
    if (entry.dirty) {
      const dot = document.createElement("span");
      dot.className = "dotdirty";
      dot.title = "unsaved changes";
      tab.appendChild(dot);
    }
    tab.addEventListener("click", () => {
      active = path;
      editor.setModel(entry.model);
      renderTabs();
      el.save.disabled = !entry.dirty;
      void loadTree();
    });
    el.tabs.appendChild(tab);
  }
}

async function openFile(rel) {
  setStatus("opening...");
  const res = await ide.readFile(rel);
  if (res.error) {
    setStatus("error");
    write(rel + ": " + res.error + "\n", "err");
    return;
  }
  if (open.has(rel)) {
    active = rel;
    editor.setModel(open.get(rel).model);
  } else {
    const model = monaco.editor.createModel(
      res.content,
      languageFor(rel),
      monaco.Uri.parse("file:///" + rel.replace(/\\/g, "/"))
    );
    open.set(rel, { model, dirty: false });
    active = rel;
    editor.setModel(model);
  }
  renderTabs();
  el.save.disabled = !open.get(rel).dirty;
  setStatus("ready");
  void loadTree();
}

async function saveActive() {
  if (!active) return;
  const entry = open.get(active);
  if (!entry) return;
  const res = await ide.writeFile(active, entry.model.getValue());
  if (res.error) {
    setStatus("save failed");
    write("save " + active + ": " + res.error + "\n", "err");
    return;
  }
  entry.dirty = false;
  renderTabs();
  el.save.disabled = true;
  setStatus("saved");
  write("saved " + active + "\n", "ok");
}

/* -------------------------------------------------------------- terminal */

function startShell() {
  ide.shellStart().then((info) => {
    el.shellName.textContent = info.shell;
    write(info.shell + " ready - type a command and press Enter\n", "ok");
  });
  ide.onShellOutput((text) => write(text));
  ide.onShellClose((code) => {
    el.shellName.textContent = "exited";
    write("\n[process exited with code " + code + "]\n", "err");
  });
}

function submitCommand() {
  const value = el.cmd.value.trim();
  if (!value) return;
  history.unshift(value);
  historyAt = -1;
  write("> " + value + "\n");
  el.cmd.value = "";
  ide.shellInput(value);
}

/* ------------------------------------------------------------------ wire */

async function init() {
  // Monaco is loaded from the app's own node_modules: no CDN, works offline.
  require.config({ paths: { vs: "../node_modules/monaco-editor/min/vs" } });
  window.MonacoEnvironment = {
    getWorkerUrl: () =>
      require.toUrl("../node_modules/monaco-editor/min/vs/base/worker/workerMain.js"),
  };
  await new Promise((resolve) => {
    require(["vs/editor/editor.main"], () => resolve());
  });

  monaco.editor.defineTheme("kore", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#000000",
      "editor.foreground": "#e8e8e8",
      "editorLineNumber.foreground": "#4a4a4a",
      "editorLineNumber.activeForeground": "#b5cfa0",
      "editor.selectionBackground": "#2a3a2a",
      "editorCursor.foreground": "#4ade80",
    },
  });

  editor = monaco.editor.create(el.editor, {
    theme: "kore",
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: 13,
    minimap: { enabled: true },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    renderWhitespace: "selection",
  });

  editor.onDidChangeModelContent(() => {
    if (!active) return;
    const entry = open.get(active);
    if (!entry || entry.dirty) return;
    entry.dirty = true;
    renderTabs();
    el.save.disabled = false;
    setStatus("modified");
  });

  el.save.addEventListener("click", () => void saveActive());
  el.refresh.addEventListener("click", () => void loadTree());
  el.clearTerm.addEventListener("click", () => {
    el.terminal.innerHTML = "";
  });
  el.openFolder.addEventListener("click", async () => {
    const chosen = await ide.openFolder();
    if (!chosen) return;
    el.root.textContent = chosen;
    el.root.title = chosen;
    write("opened " + chosen + "\n", "ok");
    await loadTree();
  });

  el.cmd.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      submitCommand();
      return;
    }
    // Up/Down recall previous commands.
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      if (!history.length) return;
      historyAt =
        e.key === "ArrowUp"
          ? Math.min(historyAt + 1, history.length - 1)
          : Math.max(historyAt - 1, -1);
      el.cmd.value = historyAt < 0 ? "" : history[historyAt];
    }
  });

  // Ctrl/Cmd+S saves, the way every editor does.
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void saveActive();
    }
  });

  el.terminal.addEventListener("click", () => el.cmd.focus());

  const start = await ide.defaultFolder();
  el.root.textContent = start;
  el.root.title = start;
  await loadTree();
  startShell();
  el.cmd.focus();
  setStatus("ready");
}

init().catch((err) => {
  setStatus("failed");
  write("IDE failed to start: " + (err && err.message ? err.message : err) + "\n", "err");
});

/**
 * The ZeroKore project shell.
 *
 * A real command interpreter over a project's real stored files. Every command
 * here performs an actual database operation on `project_files` — nothing is
 * simulated, and every failure is a real failure. This is a *project shell*,
 * not a machine shell: it cannot touch anything outside the project, which is
 * precisely what makes it safe to run in a multi-tenant browser workspace.
 */

import { languageForPath, MAX_FILE_BYTES } from "@/lib/projects";

export interface ShellLine {
  text: string;
  tone?: "out" | "err" | "dim";
}

export interface ShellResult {
  lines: ShellLine[];
  /** The caller should refresh its file list after these commands. */
  filesChanged: boolean;
}

type FileRow = {
  path: string;
  content: string | null;
  language: string;
  updated_at: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type From = any;

class ShellError extends Error {}

const out = (text: string, tone: ShellLine["tone"] = "out"): ShellLine => ({ text, tone });
const err = (text: string): ShellLine => ({ text, tone: "err" });

/** Tokenise a command line, honouring single and double quotes. */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (quote) throw new ShellError("Unclosed quote.");
  if (current) tokens.push(current);
  return tokens;
}

function validatePath(raw: string): string {
  const p = raw.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!p || p === ".") throw new ShellError("A path is required.");
  if (p.includes("..") || p.includes("\\")) throw new ShellError("That path is not allowed.");
  if (p.split("/").length > 8) throw new ShellError("That path is nested too deeply.");
  if (p.length > 400) throw new ShellError("That path is too long.");
  return p;
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

export const SHELL_BANNER = "ZeroKore project shell — type `help` for commands.";

const HELP: ShellLine[] = [
  out("Commands (operate on this project's files):", "dim"),
  out("  ls [dir]              list files"),
  out("  cat <file>            print a file's contents"),
  out("  touch <file>          create an empty file"),
  out("  mkdir <dir>           create a directory placeholder (.keep)"),
  out("  rm <path>             delete a file or directory (recursive)"),
  out("  cp <src> <dst>        copy a file"),
  out("  mv <src> <dst>        move or rename a file"),
  out("  echo <text> > <file>  write text to a file (append with >>)"),
  out("  grep <pattern>        search all files"),
  out("  wc <file>             count lines, words, bytes"),
  out("  find [prefix]         list paths starting with prefix"),
  out("  tree                  show the file tree"),
  out("  stat <file>           size and last modified"),
  out("  pwd · whoami · clear · help"),
  out("`clear` is handled by the terminal itself.", "dim"),
];

async function listFiles(supabase: From, projectId: string): Promise<FileRow[]> {
  const { data, error } = await supabase
    .from("project_files")
    .select("path, content, language, updated_at")
    .eq("project_id", projectId)
    .order("path", { ascending: true });
  if (error) throw new ShellError(`File listing failed: ${error.message}`);
  return (data ?? []) as FileRow[];
}

async function readFile(supabase: From, projectId: string, path: string): Promise<FileRow> {
  const { data } = await supabase
    .from("project_files")
    .select("path, content, language, updated_at")
    .eq("project_id", projectId)
    .eq("path", path)
    .maybeSingle();
  if (!data) throw new ShellError(`${path}: no such file.`);
  return data as FileRow;
}

async function upsertFile(
  supabase: From,
  projectId: string,
  path: string,
  content: string
): Promise<void> {
  const { error } = await supabase.from("project_files").upsert(
    {
      project_id: projectId,
      path,
      content,
      language: languageForPath(path),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,path" }
  );
  if (error) throw new ShellError(`Write failed: ${error.message}`);
}

async function deletePaths(supabase: From, projectId: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("project_id", projectId)
    .in("path", paths);
  if (error) throw new ShellError(`Delete failed: ${error.message}`);
}

function childrenOf(rows: FileRow[], dir: string): { dirs: Set<string>; names: string[] } {
  const prefix = dir ? `${dir}/` : "";
  const dirs = new Set<string>();
  const names: string[] = [];
  for (const f of rows) {
    if (!f.path.startsWith(prefix)) continue;
    const rest = f.path.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash === -1) names.push(rest);
    else dirs.add(rest.slice(0, slash));
  }
  return { dirs, names };
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, " ");
}

function byteSize(s: string | null): number {
  return s ? new Blob([s]).size : 0;
}

/* ---------------------------------------------------------------- commands */

async function runLs(supabase: From, projectId: string, arg?: string): Promise<ShellLine[]> {
  const dir = arg ? validatePath(arg) : "";
  const files = await listFiles(supabase, projectId);
  const { dirs, names } = childrenOf(files, dir);
  if (dirs.size === 0 && names.length === 0) {
    return [out(dir ? `${dir}/ is empty or does not exist.` : "No files yet. Try `touch index.html`.")];
  }
  const lines: ShellLine[] = [];
  for (const d of [...dirs].sort()) lines.push(out(`${d}/`, "dim"));
  for (const n of names.sort()) {
    const row = files.find((f) => f.path === (dir ? `${dir}/${n}` : n));
    lines.push(out(`${pad(byteSize(row?.content ?? null), 7)}  ${n}`));
  }
  return lines;
}

async function runTree(files: FileRow[]): Promise<ShellLine[]> {
  if (files.length === 0) return [out("(empty)")];
  const root: Record<string, unknown> = {};
  for (const f of files) {
    let node = root as Record<string, Record<string, unknown>>;
    for (const part of f.path.split("/")) {
      node[part] = node[part] ?? {};
      node = node[part] as Record<string, Record<string, unknown>>;
    }
    (node as Record<string, unknown>).__file = true;
  }
  const lines: ShellLine[] = [out(".")];
  const walk = (node: Record<string, unknown>, indent: string) => {
    const keys = Object.keys(node)
      .filter((k) => k !== "__file")
      .sort();
    keys.forEach((k, i) => {
      const last = i === keys.length - 1;
      const child = node[k] as Record<string, unknown>;
      const isFile = Boolean(child.__file);
      lines.push(out(`${indent}${last ? "└─ " : "├─ "}${k}${isFile ? "" : "/"}`));
      walk(child, `${indent}${last ? "   " : "│  "}`);
    });
  };
  walk(root, "");
  return lines;
}

export async function runShellCommand(
  supabase: From,
  projectId: string,
  raw: string,
  username: string
): Promise<ShellResult> {
  const line = raw.trim();
  if (!line) return { lines: [], filesChanged: false };

  const tokens = tokenize(line);
  const cmd = tokens[0];
  const args = tokens.slice(1);
  const db = supabase as From;

  /** All stored paths that are the path itself or inside it. */
  const targetsFor = (path: string, files: FileRow[]): string[] =>
    files
      .map((f) => f.path)
      .filter((p) => p === path || p.startsWith(`${path}/`));

  try {
    switch (cmd) {
      case "help":
      case "?":
        return { lines: HELP, filesChanged: false };

      case "pwd":
        return { lines: [out(`/~${username}`)], filesChanged: false };

      case "whoami":
        return { lines: [out(username)], filesChanged: false };

      case "ls":
      case "dir":
        return { lines: await runLs(db, projectId, args[0]), filesChanged: false };

      case "tree":
        return { lines: await runTree(await listFiles(db, projectId)), filesChanged: false };

      case "cat": {
        if (!args[0]) throw new ShellError("usage: cat <file>");
        const file = await readFile(db, projectId, validatePath(args[0]));
        if (!file.content) return { lines: [out("(empty file)")], filesChanged: false };
        return {
          lines: file.content.split("\n").map((l) => out(l)),
          filesChanged: false,
        };
      }

      case "stat": {
        if (!args[0]) throw new ShellError("usage: stat <file>");
        const file = await readFile(db, projectId, validatePath(args[0]));
        return {
          lines: [
            out(`path:     ${file.path}`),
            out(`bytes:    ${byteSize(file.content)}`),
            out(`language: ${file.language}`),
            out(`modified: ${file.updated_at}`),
          ],
          filesChanged: false,
        };
      }


      case "touch": {
        if (!args[0]) throw new ShellError("usage: touch <file>");
        const path = validatePath(args[0]);
        const existing = await readFile(db, projectId, path).catch(() => null);
        if (existing) return { lines: [out(`${path}: already exists.`)], filesChanged: false };
        await upsertFile(db, projectId, path, "");
        return { lines: [out(`created ${path}`)], filesChanged: true };
      }

      case "mkdir": {
        if (!args[0]) throw new ShellError("usage: mkdir <dir>");
        const dir = validatePath(args[0]);
        await upsertFile(db, projectId, `${dir}/.keep`, "");
        return { lines: [out(`created ${dir}/`)], filesChanged: true };
      }

      case "rm": {
        if (!args[0]) throw new ShellError("usage: rm <path>");
        const path = validatePath(args[0]);
        const files = await listFiles(db, projectId);
        const targets = [...new Set(targetsFor(path, files))];
        if (targets.length === 0) throw new ShellError(`${path}: no such file or directory.`);
        await deletePaths(db, projectId, targets);
        return {
          lines: [out(`removed ${targets.length} entr${targets.length === 1 ? "y" : "ies"}.`)],
          filesChanged: true,
        };
      }

      case "cp": {
        if (args.length < 2) throw new ShellError("usage: cp <src> <dst>");
        const src = await readFile(db, projectId, validatePath(args[0]));
        const dstRaw = args[1];
        // `cp a.txt dir/` copies INTO the directory under the same name.
        const dst = dstRaw.endsWith("/")
          ? `${dstRaw}${baseName(src.path)}`
          : dstRaw;
        await upsertFile(db, projectId, validatePath(dst), src.content ?? "");
        return { lines: [out(`${src.path} → ${dst}`)], filesChanged: true };
      }

      case "mv": {
        if (args.length < 2) throw new ShellError("usage: mv <src> <dst>");
        const src = await readFile(db, projectId, validatePath(args[0]));
        const dstRaw = args[1];
        const dst = dstRaw.endsWith("/")
          ? `${dstRaw}${baseName(src.path)}`
          : dstRaw;
        await upsertFile(db, projectId, validatePath(dst), src.content ?? "");
        await deletePaths(db, projectId, [src.path]);
        return { lines: [out(`${src.path} → ${dst}`)], filesChanged: true };
      }

      case "echo": {
        // `echo text > file` writes; `echo text >> file` appends; with no
        // redirect it simply prints, like every other shell.
        const joined = args.join(" ");
        const redirect = /^(.*?)(?:\s)(>>|>)\s*(\S.*)$/.exec(joined);
        if (!redirect) return { lines: [out(joined)], filesChanged: false };
        const text = redirect[1].trim().replace(/^["']|["']$/g, "");
        const op = redirect[2];
        const path = validatePath(redirect[3]);
        const existing = await readFile(db, projectId, path).catch(() => null);
        const content =
          op === ">>" && existing?.content
            ? `${existing.content.replace(/\n$/, "")}\n${text}\n`
            : `${text}\n`;
        if (byteSize(content) > MAX_FILE_BYTES) {
          throw new ShellError("That file would exceed the size limit.");
        }
        await upsertFile(db, projectId, path, content);
        return { lines: [out(`wrote ${path}`)], filesChanged: true };
      }

      case "grep": {
        if (!args[0]) throw new ShellError("usage: grep <pattern>");
        const needle = args.join(" ").toLowerCase();
        const files = await listFiles(db, projectId);
        const lines: ShellLine[] = [];
        let hits = 0;
        for (const f of files) {
          const content = f.content ?? "";
          if (!content) continue;
          const body = content.split("\n");
          for (let i = 0; i < body.length; i++) {
            if (hits >= 200) break;
            if (body[i].toLowerCase().includes(needle)) {
              lines.push(out(`${f.path}:${i + 1}: ${body[i].trim().slice(0, 160)}`));
              hits += 1;
            }
          }
          if (hits >= 200) break;
        }
        if (lines.length === 0) return { lines: [out("no matches.")], filesChanged: false };
        lines.push(out(`— ${hits} match${hits === 1 ? "" : "es"} —`, "dim"));
        return { lines, filesChanged: false };
      }

      case "wc": {
        if (!args[0]) throw new ShellError("usage: wc <file>");
        const file = await readFile(db, projectId, validatePath(args[0]));
        const content = file.content ?? "";
        return {
          lines: [
            out(
              `${pad(content.split("\n").length, 4)} lines  ${pad(
                content.split(/\s+/).filter(Boolean).length,
                4
              )} words  ${pad(byteSize(content), 6)} bytes  ${file.path}`
            ),
          ],
          filesChanged: false,
        };
      }

      case "find": {
        const files = await listFiles(db, projectId);
        const prefix = args[0] ? validatePath(args[0]) : "";
        const matches = files.map((f) => f.path).filter((p) => !prefix || p.startsWith(prefix));
        if (matches.length === 0) return { lines: [out("no matches.")], filesChanged: false };
        return { lines: matches.map((p) => out(p)), filesChanged: false };
      }

      default:
        throw new ShellError(
          `${cmd}: command not found. Type \`help\` to see what this shell can do.`
        );
    }
  } catch (e) {
    if (e instanceof ShellError) return { lines: [err(e.message)], filesChanged: false };
    return {
      lines: [err(e instanceof Error ? e.message : "The command failed.")],
      filesChanged: false,
    };
  }
}


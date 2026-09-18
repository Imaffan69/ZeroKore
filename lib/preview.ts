/**
 * Build one self-contained preview document from an imported static site.
 *
 * Imported repositories reference sibling assets by relative path
 * (`<link href="./style.css">`, `<script src="app.js">`). A preview frame has
 * no way to resolve those, so the referenced text assets are inlined here. This
 * is a real transformation of real files — nothing is invented, and anything
 * that cannot be resolved is left exactly as authored.
 */

/** Resolve a reference against the directory of the document, safely. */
function resolvePath(baseDir: string, ref: string): string {
  const raw = ref.startsWith("/") ? ref.slice(1) : `${baseDir}${ref}`;
  const out: string[] = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/** Strip a query string or fragment from a reference. */
function cleanRef(ref: string): string {
  return ref.split(/[?#]/)[0];
}

export function buildPreviewDocument(
  htmlPath: string,
  files: Map<string, string>
): string | null {
  const html = files.get(htmlPath);
  if (!html) return null;

  const lastSlash = htmlPath.lastIndexOf("/");
  const baseDir = lastSlash === -1 ? "" : htmlPath.slice(0, lastSlash + 1);

  let out = html;

  // Inline stylesheets.
  out = out.replace(
    /<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi,
    (tag: string, href: string) => {
      const ref = cleanRef(href);
      if (!/\.css$/i.test(ref)) return tag;
      const css = files.get(resolvePath(baseDir, ref));
      if (css == null) return tag;
      return `<style data-zk-inlined="${ref}">\n${css}\n</style>`;
    }
  );

  // Inline scripts that reference a local file.
  out = out.replace(
    /<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (tag: string, src: string) => {
      const ref = cleanRef(src);
      const js = files.get(resolvePath(baseDir, ref));
      if (js == null) return tag;
      return `<script data-zk-inlined="${ref}">\n${js}\n</script>`;
    }
  );

  return out;
}

/** Files that make a sensible entry point, best candidate first. */
const ENTRY_CANDIDATES = [
  "index.html",
  "public/index.html",
  "src/index.html",
  "dist/index.html",
  "build/index.html",
  "app/index.html",
  "www/index.html",
];

/** Pick the document to preview from an imported file set. */
export function pickPreviewEntry(paths: string[]): string | null {
  for (const candidate of ENTRY_CANDIDATES) {
    if (paths.includes(candidate)) return candidate;
  }
  // Otherwise the shallowest HTML file is the best available entry.
  const html = paths
    .filter((p) => /\.html?$/i.test(p))
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  return html[0] ?? null;
}
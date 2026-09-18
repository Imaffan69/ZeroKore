/**
 * Minimal, escape-first markdown → HTML renderer.
 *
 * Everything is HTML-escaped *before* any transformation, so the output can be
 * handed to `dangerouslySetInnerHTML` without allowing raw HTML, event handler
 * attributes or `javascript:` URLs through. Only the constructs below are
 * supported — enough for skill documents and generated artifacts, and
 * deliberately no more.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** Placeholder that cannot appear in escaped user content. */
const TOKEN = "\u0000";

export function renderSafeMarkdown(source: string): string {
  let out = escapeHtml(source.replace(/\r\n/g, "\n"));

  // 1. Fenced code blocks, extracted first so their contents stay untouched.
  const blocks: string[] = [];
  out = out.replace(
    /```([\w+#.-]*)\n?([\s\S]*?)```/g,
    (_match, lang: string, code: string) => {
      const safeLang = /^[\w+#.-]{0,20}$/.test(lang) ? lang || "text" : "text";
      blocks.push(
        `<pre data-lang="${safeLang}"><code>${code.replace(/\n$/, "")}</code></pre>`
      );
      return `${TOKEN}${blocks.length - 1}${TOKEN}`;
    }
  );

  // 2. Block-level constructs.
  out = out
    .replace(/^###### (.*)$/gm, "<h6>$1</h6>")
    .replace(/^##### (.*)$/gm, "<h5>$1</h5>")
    .replace(/^#### (.*)$/gm, "<h5>$1</h5>")
    .replace(/^### (.*)$/gm, "<h4>$1</h4>")
    .replace(/^## (.*)$/gm, "<h3>$1</h3>")
    .replace(/^# (.*)$/gm, "<h2>$1</h2>")
    .replace(/^(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "<hr/>")
    .replace(/^&gt; ?(.*)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^(?:[-*+]|\d{1,3}\.) (.*)$/gm, "<li>$1</li>");

  // Group adjacent list items into a single list.
  out = out.replace(/(?:<li>[\s\S]*?<\/li>\n?)+/g, (match) => {
    return `<ul>${match.replace(/\n/g, "")}</ul>`;
  });

  // 3. Inline constructs (bold before italic so `**` wins).
  out = out
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(
      /\[([^\]\n]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    .replace(
      /(^|[\s(])(https?:\/\/[^\s)]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
    );

  // 4. Wrap remaining loose text in paragraphs; never wrap existing blocks.
  const BLOCK_START = /^<(h[1-6]|ul|ol|li|pre|blockquote|hr|p|table|div)\b/;
  out = out
    .split(/\n{2,}/)
    .map((chunk) => {
      const text = chunk.trim();
      if (!text) return "";
      if (BLOCK_START.test(text)) return text;
      return `<p>${text.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  // 5. Restore the extracted code blocks.
  return out.replace(
    new RegExp(`${TOKEN}(\\d+)${TOKEN}`, "g"),
    (_match, index: string) => blocks[Number(index)] ?? ""
  );
}

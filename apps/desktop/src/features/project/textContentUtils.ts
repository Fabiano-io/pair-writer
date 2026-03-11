/**
 * Provisional text ↔ HTML conversion for .md and .txt files.
 * Limited and temporary — does not represent final editorial pipeline nor rich Markdown support.
 */

/**
 * Converts plain text to simple HTML (paragraphs, line breaks).
 */
export function textToSimpleHtml(text: string): string {
  if (!text.trim()) return "<p></p>";
  const paragraphs = text.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      const lines = p.split(/\n/);
      const content = lines.join("<br/>");
      return `<p>${content}</p>`;
    })
    .join("");
}

/**
 * Extracts plain text from HTML.
 */
export function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") {
    return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p><p>/gi, "\n\n").replace(/<[^>]*>/g, "");
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.innerText ?? div.textContent ?? "";
}

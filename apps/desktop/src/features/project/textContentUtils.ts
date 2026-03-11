/**
 * Provisional text/markdown <-> HTML conversion utilities.
 * Practical and intentionally limited for this cycle.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMarkdown(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * Converts plain text to simple HTML (paragraphs + line breaks).
 */
export function textToSimpleHtml(text: string): string {
  if (!text.trim()) return "<p></p>";
  const paragraphs = text.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      const lines = p.split(/\n/);
      return `<p>${lines.map((line) => escapeHtml(line)).join("<br/>")}</p>`;
    })
    .join("");
}

/**
 * Converts markdown to rendered HTML (limited subset).
 */
export function markdownToSimpleHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "<p></p>";

  const blocks = normalized.split(/\n\n+/);
  const html = blocks.map((block) => {
    const trimmed = block.trim();

    if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
      const inner = trimmed.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
      return `<pre><code>${escapeHtml(inner)}</code></pre>`;
    }

    const listLines = trimmed.split("\n");
    const isUnorderedList = listLines.every((line) => /^[-*+]\s+/.test(line));
    if (isUnorderedList) {
      const items = listLines
        .map((line) => line.replace(/^[-*+]\s+/, "").trim())
        .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    }

    const isOrderedList = listLines.every((line) => /^\d+\.\s+/.test(line));
    if (isOrderedList) {
      const items = listLines
        .map((line) => line.replace(/^\d+\.\s+/, "").trim())
        .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
        .join("");
      return `<ol>${items}</ol>`;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      return `<h${level}>${renderInlineMarkdown(heading[2].trim())}</h${level}>`;
    }

    if (trimmed.startsWith(">")) {
      const quote = listLines
        .map((line) => line.replace(/^>\s?/, ""))
        .join("<br/>");
      return `<blockquote>${renderInlineMarkdown(quote)}</blockquote>`;
    }

    return `<p>${listLines.map((line) => renderInlineMarkdown(line)).join("<br/>")}</p>`;
  });

  return html.join("");
}

function convertElementToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const content = Array.from(element.childNodes)
    .map((child) => convertElementToMarkdown(child))
    .join("");

  switch (tag) {
    case "br":
      return "\n";
    case "p":
      return `${content}\n\n`;
    case "h1":
      return `# ${content.trim()}\n\n`;
    case "h2":
      return `## ${content.trim()}\n\n`;
    case "h3":
      return `### ${content.trim()}\n\n`;
    case "h4":
      return `#### ${content.trim()}\n\n`;
    case "h5":
      return `##### ${content.trim()}\n\n`;
    case "h6":
      return `###### ${content.trim()}\n\n`;
    case "strong":
    case "b":
      return `**${content}**`;
    case "em":
    case "i":
      return `*${content}*`;
    case "code": {
      if (element.parentElement?.tagName.toLowerCase() === "pre") {
        return content;
      }
      return `\`${content}\``;
    }
    case "pre":
      return `\`\`\`\n${content.trimEnd()}\n\`\`\`\n\n`;
    case "blockquote": {
      const lines = content.trim().split(/\n/).filter(Boolean);
      return `${lines.map((line) => `> ${line}`).join("\n")}\n\n`;
    }
    case "ul": {
      const items = Array.from(element.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((li) => `- ${convertElementToMarkdown(li).trim()}`)
        .join("\n");
      return `${items}\n\n`;
    }
    case "ol": {
      const items = Array.from(element.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((li, index) => `${index + 1}. ${convertElementToMarkdown(li).trim()}`)
        .join("\n");
      return `${items}\n\n`;
    }
    case "li":
      return content.replace(/\n\n+$/, "");
    case "a": {
      const href = element.getAttribute("href") ?? "";
      return `[${content}](${href})`;
    }
    default:
      return content;
  }
}

/**
 * Converts HTML to markdown text (limited subset).
 */
export function htmlToMarkdown(html: string): string {
  if (typeof document === "undefined") {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
      .trim();
  }

  const root = document.createElement("div");
  root.innerHTML = html;
  const markdown = Array.from(root.childNodes)
    .map((child) => convertElementToMarkdown(child))
    .join("");

  return markdown.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Extracts plain text from HTML.
 */
export function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p><p>/gi, "\n\n")
      .replace(/<[^>]*>/g, "");
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.innerText ?? div.textContent ?? "";
}
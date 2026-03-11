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
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function isHorizontalRule(line: string): boolean {
  return /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line);
}

function isUnorderedListLine(line: string): boolean {
  return /^[-*+]\s+/.test(line.trim());
}

function parseTaskListLine(
  line: string
): { checked: boolean; text: string } | null {
  const match = line.trim().match(/^[-*+]\s+\[( |x|X)\]\s+(.*)$/);
  if (!match) {
    return null;
  }
  return {
    checked: match[1].toLowerCase() === "x",
    text: match[2],
  };
}

function isOrderedListLine(line: string): boolean {
  return /^\d+\.\s+/.test(line.trim());
}

function isHeadingLine(line: string): boolean {
  return /^#{1,6}\s+/.test(line.trim());
}

function isCodeFenceLine(line: string): boolean {
  return /^```/.test(line.trim());
}

function isBlockquoteLine(line: string): boolean {
  return /^>\s?/.test(line.trim());
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableRowLine(line: string): boolean {
  return line.includes("|");
}

function isTableSeparatorLine(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
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

  const lines = normalized.split("\n");
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (isCodeFenceLine(trimmed)) {
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !isCodeFenceLine(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && isCodeFenceLine(lines[i])) {
        i += 1;
      }
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    if (isHorizontalRule(trimmed)) {
      html.push("<hr/>");
      i += 1;
      continue;
    }

    const taskItem = parseTaskListLine(line);
    if (taskItem) {
      const items: Array<{ checked: boolean; text: string }> = [];
      while (i < lines.length) {
        const currentTaskItem = parseTaskListLine(lines[i]);
        if (!currentTaskItem) {
          break;
        }
        items.push(currentTaskItem);
        i += 1;
      }
      html.push(
        `<ul class="md-task-list">${items
          .map(
            (item) =>
              `<li data-task="true" data-checked="${item.checked ? "true" : "false"}"><span data-task-box="true">${item.checked ? "☑" : "☐"}</span><span data-task-label="true">${renderInlineMarkdown(item.text)}</span></li>`
          )
          .join("")}</ul>`
      );
      continue;
    }

    if (
      isTableRowLine(line) &&
      i + 1 < lines.length &&
      isTableSeparatorLine(lines[i + 1])
    ) {
      const headerCells = splitTableRow(line).map((cell) =>
        renderInlineMarkdown(cell)
      );
      i += 2;

      const dataRows: string[][] = [];
      while (i < lines.length && lines[i].trim() && isTableRowLine(lines[i])) {
        dataRows.push(
          splitTableRow(lines[i]).map((cell) => renderInlineMarkdown(cell))
        );
        i += 1;
      }

      const thead = `<thead><tr>${headerCells
        .map((cell) => `<th>${cell}</th>`)
        .join("")}</tr></thead>`;
      const tbody = `<tbody>${dataRows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
        )
        .join("")}</tbody>`;
      html.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    if (isUnorderedListLine(line)) {
      const items: string[] = [];
      while (i < lines.length && isUnorderedListLine(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
        i += 1;
      }
      html.push(
        `<ul>${items
          .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
          .join("")}</ul>`
      );
      continue;
    }

    if (isOrderedListLine(line)) {
      const items: string[] = [];
      while (i < lines.length && isOrderedListLine(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      html.push(
        `<ol>${items
          .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
          .join("")}</ol>`
      );
      continue;
    }

    if (isHeadingLine(line)) {
      const heading = line.trim().match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        html.push(
          `<h${level}>${renderInlineMarkdown(heading[2].trim())}</h${level}>`
        );
      }
      i += 1;

      const paragraphLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !isCodeFenceLine(lines[i]) &&
        !isHorizontalRule(lines[i]) &&
        !isHeadingLine(lines[i]) &&
        !isUnorderedListLine(lines[i]) &&
        !isOrderedListLine(lines[i]) &&
        !isBlockquoteLine(lines[i]) &&
        !(
          isTableRowLine(lines[i]) &&
          i + 1 < lines.length &&
          isTableSeparatorLine(lines[i + 1])
        )
      ) {
        paragraphLines.push(lines[i]);
        i += 1;
      }

      if (paragraphLines.length > 0) {
        html.push(
          `<p>${paragraphLines
            .map((currentLine) => renderInlineMarkdown(currentLine))
            .join("<br/>")}</p>`
        );
      }
      continue;
    }

    if (isBlockquoteLine(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && isBlockquoteLine(lines[i])) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      html.push(
        `<blockquote>${quoteLines
          .map((currentLine) => renderInlineMarkdown(currentLine))
          .join("<br/>")}</blockquote>`
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isCodeFenceLine(lines[i]) &&
      !isHorizontalRule(lines[i]) &&
      !isHeadingLine(lines[i]) &&
      !isUnorderedListLine(lines[i]) &&
      !isOrderedListLine(lines[i]) &&
      !isBlockquoteLine(lines[i]) &&
      !(isTableRowLine(lines[i]) && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1]))
    ) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    html.push(
      `<p>${paragraphLines
        .map((currentLine) => renderInlineMarkdown(currentLine))
        .join("<br/>")}</p>`
    );
  }

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
    case "s":
    case "del":
    case "strike":
      return `~~${content}~~`;
    case "code": {
      if (element.parentElement?.tagName.toLowerCase() === "pre") {
        return content;
      }
      return `\`${content}\``;
    }
    case "pre":
      return `\`\`\`\n${content.trimEnd()}\n\`\`\`\n\n`;
    case "hr":
      return `---\n\n`;
    case "blockquote": {
      const lines = content.trim().split(/\n/).filter(Boolean);
      return `${lines.map((currentLine) => `> ${currentLine}`).join("\n")}\n\n`;
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
    case "li": {
      if (element.dataset.task === "true") {
        const labelElement = element.querySelector(
          '[data-task-label="true"]'
        ) as HTMLElement | null;
        const label = (
          labelElement
            ? convertElementToMarkdown(labelElement)
            : content.replace(/[☑☐]/g, "")
        ).trim();
        const checked =
          element.dataset.checked === "true" ||
          ((element.querySelector('input[type="checkbox"]') as HTMLInputElement | null)
            ?.checked ??
            false) ||
          (element.textContent ?? "").includes("☑");
        return `[${checked ? "x" : " "}] ${label}`;
      }
      return content.replace(/\n\n+$/, "");
    }
    case "table": {
      const table = element as HTMLTableElement;
      const rowElements: HTMLTableRowElement[] = [];

      if (table.tHead) {
        rowElements.push(...Array.from(table.tHead.rows));
      }
      if (table.tBodies.length > 0) {
        for (const tbody of Array.from(table.tBodies)) {
          rowElements.push(...Array.from(tbody.rows));
        }
      }
      if (rowElements.length === 0) {
        rowElements.push(...Array.from(table.rows));
      }

      if (rowElements.length === 0) return "";

      const rows = rowElements.map((row) =>
        Array.from(row.cells).map((cell) => convertElementToMarkdown(cell).trim())
      );
      if (rows.length === 0) return "";

      const header = rows[0];
      const separator = header.map(() => "---");
      const body = rows.slice(1);

      const markdownRows = [
        `| ${header.join(" | ")} |`,
        `| ${separator.join(" | ")} |`,
        ...body.map((row) => `| ${row.join(" | ")} |`),
      ];
      return `${markdownRows.join("\n")}\n\n`;
    }
    case "th":
    case "td":
      return content.replace(/\n+/g, " ").trim();
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

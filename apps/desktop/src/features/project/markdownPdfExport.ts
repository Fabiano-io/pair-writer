import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { TableKit } from "@tiptap/extension-table";
import { common, createLowlight } from "lowlight";
import { exportHtmlDocumentAsPdf } from "./projectAccess";

const lowlight = createLowlight(common);

type MermaidApi = typeof import("mermaid").default;

let mermaidApiPromise: Promise<MermaidApi> | null = null;
let mermaidRenderCounter = 0;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function normalizeLanguage(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_+-]/g, "");
  return normalized.length > 0 ? normalized : null;
}

function resolveCodeBlockLanguage(pre: HTMLElement): string | null {
  const code = pre.querySelector("code");
  const fromData =
    pre.getAttribute("data-language") ?? code?.getAttribute("data-language");
  if (fromData) {
    return normalizeLanguage(fromData);
  }

  const classNames = Array.from(code?.classList ?? []);
  const prefixed = classNames.find((className) =>
    className.startsWith("language-")
  );
  return normalizeLanguage(prefixed?.slice("language-".length));
}

function sanitizeMermaidSource(rawValue: string): string {
  return rawValue
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

async function getMermaidApi(): Promise<MermaidApi> {
  if (!mermaidApiPromise) {
    mermaidApiPromise = import("mermaid").then((module) => {
      const api = module.default;
      api.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: "default",
      });
      return api;
    });
  }
  return mermaidApiPromise;
}

function ensurePdfExtension(outputPath: string): string {
  return outputPath.toLowerCase().endsWith(".pdf")
    ? outputPath
    : `${outputPath}.pdf`;
}

function serializeLowlightNode(node: unknown): string {
  if (Array.isArray(node)) {
    return node.map(serializeLowlightNode).join("");
  }

  if (!node || typeof node !== "object") {
    return "";
  }

  const candidate = node as {
    type?: string;
    value?: string;
    tagName?: string;
    properties?: { className?: string[] | string };
    children?: unknown[];
  };

  if (candidate.type === "text") {
    return escapeHtml(candidate.value ?? "");
  }

  if (candidate.type === "root") {
    return (candidate.children ?? []).map(serializeLowlightNode).join("");
  }

  if (candidate.type !== "element" || !candidate.tagName) {
    return "";
  }

  const classNames = candidate.properties?.className;
  const classValue = Array.isArray(classNames)
    ? classNames.join(" ")
    : typeof classNames === "string"
      ? classNames
      : "";

  const attrs = classValue ? ` class="${escapeAttribute(classValue)}"` : "";
  const children = (candidate.children ?? []).map(serializeLowlightNode).join("");

  return `<${candidate.tagName}${attrs}>${children}</${candidate.tagName}>`;
}

function highlightCodeHtml(source: string, language: string | null): string {
  const normalizedLanguage = normalizeLanguage(language);
  if (normalizedLanguage && lowlight.listLanguages().includes(normalizedLanguage)) {
    return serializeLowlightNode(lowlight.highlight(normalizedLanguage, source));
  }

  if (normalizedLanguage) {
    try {
      return serializeLowlightNode(lowlight.highlightAuto(source));
    } catch {
      return escapeHtml(source);
    }
  }

  return escapeHtml(source);
}

function createExportEditor(markdown: string): Editor {
  const editor = new Editor({
    element: document.createElement("div"),
    editable: false,
    content: "",
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({
        lowlight,
        languageClassPrefix: "language-",
        HTMLAttributes: {
          class: "md-code-block",
        },
      }),
      TableKit,
      Markdown.configure({
        markedOptions: {
          gfm: true,
          breaks: false,
        },
      }),
    ],
  });

  const markdownManager = editor.markdown;
  if (!markdownManager) {
    editor.destroy();
    throw new Error("Markdown export parser is not available.");
  }

  const parsed = markdownManager.parse(markdown);
  editor.commands.setContent(parsed, { emitUpdate: false });

  return editor;
}

async function enhanceCodeBlocks(root: HTMLElement): Promise<void> {
  const preBlocks = Array.from(root.querySelectorAll<HTMLElement>("pre"));

  for (const pre of preBlocks) {
    const code = pre.querySelector("code");
    const source = code?.textContent ?? pre.textContent ?? "";
    const language = resolveCodeBlockLanguage(pre);

    pre.classList.add("md-code-block");
    if (language) {
      pre.setAttribute("data-language", language);
    }

    if (code) {
      code.innerHTML = highlightCodeHtml(source, language);
    } else {
      pre.innerHTML = highlightCodeHtml(source, language);
    }

    const wrapper = document.createElement("div");
    wrapper.className = "md-code-block-wrapper";

    const header = document.createElement("div");
    header.className = "md-code-block-header";

    const label = document.createElement("span");
    label.className = "md-code-block-language";
    label.textContent = language ? language.toUpperCase() : "CODE";
    header.appendChild(label);
    wrapper.appendChild(header);

    if (language === "mermaid") {
      const preview = document.createElement("div");
      preview.className = "md-mermaid-preview";

      const mermaidSource = sanitizeMermaidSource(source);
      if (mermaidSource) {
        try {
          const mermaid = await getMermaidApi();
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            suppressErrorRendering: true,
            theme: "default",
          });
          const renderId = `pw-export-mermaid-${++mermaidRenderCounter}`;
          const result = await mermaid.render(renderId, mermaidSource);
          preview.innerHTML = `<div class="md-mermaid-canvas">${result.svg}</div>`;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to render Mermaid diagram.";
          preview.innerHTML = `<div class="md-mermaid-error">${escapeHtml(message)}</div>`;
        }
      }
      wrapper.appendChild(preview);
    }

    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
  }
}

function normalizeExportContent(root: HTMLElement): void {
  root.querySelectorAll("[contenteditable]").forEach((node) => {
    node.removeAttribute("contenteditable");
  });
  root.querySelectorAll("[spellcheck]").forEach((node) => {
    node.removeAttribute("spellcheck");
  });
  root.querySelectorAll("a[href]").forEach((node) => {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noreferrer noopener");
  });
}

function buildPrintShell(documentTitle: string, bodyHtml: string): string {
  const safeTitle = escapeHtml(documentTitle);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm;
    }

    .pw-export-surface {
      --app-text-muted: #64748b;
      --editor-text: #334155;
      --editor-heading: #0f172a;
      --editor-heading-muted: #1e293b;
      --editor-blockquote-border: #cbd5e1;
      --editor-blockquote-text: #475569;
      --editor-code-bg: rgba(226, 232, 240, 0.9);
      --editor-code-text: #0f172a;
      --editor-pre-code: #0f172a;
      --editor-codeblock-bg: #f8fafc;
      --editor-codeblock-border: #d4dbe7;
      --editor-codeblock-header-bg: #eef2f7;
      --editor-codeblock-header-text: #516079;
      --editor-codeblock-header-pill-bg: rgba(255, 255, 255, 0.96);
      --editor-codeblock-header-pill-border: rgba(148, 163, 184, 0.38);
      --editor-codeblock-shadow: rgba(15, 23, 42, 0.06);
      --editor-link: #1d4ed8;
      --editor-link-hover: #1e40af;
      --editor-table-border: #cbd5e1;
      --editor-table-header-bg: #e5e7eb;
      --editor-table-cell-bg: rgba(255, 255, 255, 0.92);
      --editor-syntax-keyword: #1d4ed8;
      --editor-syntax-string: #047857;
      --editor-syntax-number: #b45309;
      --editor-syntax-function: #7c3aed;
      --editor-syntax-type: #0f766e;
      --editor-syntax-comment: #64748b;
      --editor-syntax-deletion: #dc2626;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: var(--editor-text);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: "Segoe UI", Inter, Arial, sans-serif;
      font-size: 15px;
      width: 100%;
    }

    .pw-export-surface,
    .pw-export-surface * {
      box-sizing: border-box;
    }

    .pw-export-root {
      width: 100%;
      max-width: 182mm;
      margin: 0 auto;
    }

    .pw-export-document {
      width: 100%;
    }

    .pw-export-document > *:first-child {
      margin-top: 0;
    }

    .pw-export-document > * + * {
      margin-top: 0.75em;
    }

    .pw-export-document p {
      margin: 0;
      line-height: 1.75;
      color: var(--editor-text);
    }

    .pw-export-document h1 {
      margin: 1.1em 0 0.35em;
      font-size: 2em;
      font-weight: 700;
      line-height: 1.2;
      color: var(--editor-heading);
      page-break-after: avoid;
    }

    .pw-export-document h2 {
      margin: 1.05em 0 0.3em;
      font-size: 1.5em;
      font-weight: 600;
      line-height: 1.3;
      color: var(--editor-heading);
      page-break-after: avoid;
    }

    .pw-export-document h3 {
      margin: 1em 0 0.25em;
      font-size: 1.25em;
      font-weight: 600;
      line-height: 1.35;
      color: var(--editor-heading-muted);
      page-break-after: avoid;
    }

    .pw-export-document h4,
    .pw-export-document h5,
    .pw-export-document h6 {
      margin: 0.95em 0 0.2em;
      font-size: 1.05em;
      font-weight: 600;
      line-height: 1.35;
      color: var(--editor-heading-muted);
      page-break-after: avoid;
    }

    .pw-export-document strong {
      color: var(--editor-heading);
      font-weight: 700;
    }

    .pw-export-document em {
      color: var(--editor-heading-muted);
      font-style: italic;
    }

    .pw-export-document ul,
    .pw-export-document ol {
      margin: 0;
      padding-left: 1.5em;
      color: var(--editor-text);
    }

    .pw-export-document li {
      line-height: 1.75;
      margin-top: 0.2em;
    }

    .pw-export-document blockquote {
      margin: 0;
      padding-left: 1em;
      border-left: 3px solid var(--editor-blockquote-border);
      color: var(--editor-blockquote-text);
      font-style: italic;
    }

    .pw-export-document hr {
      border: 0;
      border-top: 1px solid var(--editor-table-border);
      margin: 1.4em 0;
    }

    .pw-export-document code {
      font-family: ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace;
      font-size: 0.875em;
      background-color: var(--editor-code-bg);
      color: var(--editor-code-text);
      border-radius: 4px;
      padding: 0.1em 0.35em;
    }

    .pw-export-document .md-code-block-wrapper {
      margin: 1.15em 0 1.35em;
      border: 1px solid var(--editor-codeblock-border);
      border-radius: 14px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.98)),
        var(--editor-codeblock-bg);
      box-shadow: 0 12px 28px -18px var(--editor-codeblock-shadow);
      break-inside: avoid-page;
      page-break-inside: avoid;
    }

    .pw-export-document .md-code-block-header {
      min-height: 2.65rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.48rem 0.95rem 0.48rem 1rem;
      border-bottom: 1px solid var(--editor-codeblock-border);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(238, 242, 247, 0.96)),
        var(--editor-codeblock-header-bg);
    }

    .pw-export-document .md-code-block-language {
      display: inline-flex;
      align-items: center;
      min-height: 1.5rem;
      padding: 0.14rem 0.58rem;
      border: 1px solid var(--editor-codeblock-header-pill-border);
      border-radius: 999px;
      background: var(--editor-codeblock-header-pill-bg);
      color: var(--editor-codeblock-header-text);
      font-size: 0.69rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      line-height: 1;
      text-transform: uppercase;
    }

    .pw-export-document pre.md-code-block {
      margin: 0;
      overflow-x: hidden;
      padding: 1rem 1.18rem 1.18rem 1.22rem;
      background: transparent;
      border: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: normal;
    }

    .pw-export-document pre.md-code-block code {
      display: block;
      padding: 0;
      background: transparent;
      color: var(--editor-pre-code);
      border-radius: 0;
      font-size: 0.9rem;
      line-height: 1.68;
      letter-spacing: 0.01em;
      font-variant-ligatures: none;
      tab-size: 2;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: normal;
    }

    .pw-export-document .hljs-keyword,
    .pw-export-document .hljs-selector-tag,
    .pw-export-document .hljs-literal,
    .pw-export-document .hljs-section,
    .pw-export-document .hljs-link {
      color: var(--editor-syntax-keyword);
    }

    .pw-export-document .hljs-string,
    .pw-export-document .hljs-attribute,
    .pw-export-document .hljs-symbol,
    .pw-export-document .hljs-bullet,
    .pw-export-document .hljs-addition,
    .pw-export-document .hljs-template-tag,
    .pw-export-document .hljs-template-variable {
      color: var(--editor-syntax-string);
    }

    .pw-export-document .hljs-number,
    .pw-export-document .hljs-meta {
      color: var(--editor-syntax-number);
    }

    .pw-export-document .hljs-built_in,
    .pw-export-document .hljs-title.class_,
    .pw-export-document .hljs-title.function_ {
      color: var(--editor-syntax-function);
    }

    .pw-export-document .hljs-type,
    .pw-export-document .hljs-title,
    .pw-export-document .hljs-name,
    .pw-export-document .hljs-variable.language_,
    .pw-export-document .hljs-variable.constant_ {
      color: var(--editor-syntax-type);
    }

    .pw-export-document .hljs-comment,
    .pw-export-document .hljs-quote {
      color: var(--editor-syntax-comment);
      font-style: italic;
    }

    .pw-export-document .hljs-deletion {
      color: var(--editor-syntax-deletion);
    }

    .pw-export-document .md-mermaid-preview {
      padding: 0.9rem 1rem 0.7rem;
      border-bottom: 1px solid var(--editor-codeblock-border);
      background: linear-gradient(180deg, rgba(148, 163, 184, 0.06), transparent);
    }

    .pw-export-document .md-mermaid-canvas svg {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 0 auto;
    }

    .pw-export-document .md-mermaid-error {
      color: #dc2626;
      white-space: pre-wrap;
      font-size: 0.82rem;
    }

    .pw-export-document a {
      color: var(--editor-link);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .pw-export-document table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      table-layout: fixed;
      page-break-inside: avoid;
    }

    .pw-export-document th,
    .pw-export-document td {
      border: 1px solid var(--editor-table-border);
      padding: 0.5em 0.75em;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }

    .pw-export-document th {
      background-color: var(--editor-table-header-bg);
      color: var(--editor-heading);
      font-weight: 600;
    }

    .pw-export-document td {
      background-color: var(--editor-table-cell-bg);
      color: var(--editor-text);
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: #ffffff;">
  <div class="pw-export-surface">
    <div class="pw-export-root">
      <article class="pw-export-document">
        ${bodyHtml}
      </article>
    </div>
  </div>
</body>
</html>`;
}

export async function buildMarkdownPdfExportHtml(
  markdown: string,
  documentTitle: string
): Promise<string> {
  const editor = createExportEditor(markdown);

  try {
    const host = document.createElement("div");
    host.innerHTML = editor.getHTML();

    normalizeExportContent(host);
    await enhanceCodeBlocks(host);

    return buildPrintShell(documentTitle, host.innerHTML);
  } finally {
    editor.destroy();
  }
}

export async function exportMarkdownDocumentAsPdf(
  sourceFilePath: string,
  outputFilePath: string,
  markdown: string,
  documentTitle: string,
  projectRoot?: string | null
): Promise<string> {
  const htmlContent = await buildMarkdownPdfExportHtml(markdown, documentTitle);
  const finalOutputPath = ensurePdfExtension(outputFilePath);

  return await exportHtmlDocumentAsPdf(
    sourceFilePath,
    finalOutputPath,
    htmlContent,
    projectRoot
  );
}

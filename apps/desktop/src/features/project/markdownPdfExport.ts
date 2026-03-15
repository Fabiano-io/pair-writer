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
    wrapper.className = `md-code-block-wrapper ${
      language === "mermaid"
        ? "md-code-block-wrapper-mermaid"
        : "md-code-block-wrapper-plain"
    }`;

    if (language && language !== "mermaid") {
      const header = document.createElement("div");
      header.className = "md-code-block-header";

      const label = document.createElement("span");
      label.className = "md-code-block-language";
      label.textContent = language.toUpperCase();
      header.appendChild(label);
      wrapper.appendChild(header);
    }

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
      --editor-heading-muted: #1f2937;
      --editor-blockquote-border: #cbd5e1;
      --editor-blockquote-text: #475569;
      --editor-code-bg: rgba(226, 232, 240, 0.9);
      --editor-code-text: #0f172a;
      --editor-pre-code: #0f172a;
      --editor-codeblock-bg: #f7f9fc;
      --editor-codeblock-border: rgba(203, 213, 225, 0.56);
      --editor-codeblock-header-bg: transparent;
      --editor-codeblock-header-text: #64748b;
      --editor-codeblock-header-pill-bg: rgba(255, 255, 255, 0.96);
      --editor-codeblock-header-pill-border: rgba(203, 213, 225, 0.82);
      --editor-codeblock-shadow: rgba(15, 23, 42, 0.03);
      --editor-link: #1d4ed8;
      --editor-link-hover: #1e40af;
      --editor-table-border: #e2e8f0;
      --editor-table-header-bg: #f7f9fc;
      --editor-table-cell-bg: rgba(255, 255, 255, 0.96);
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
      font-family: "Segoe UI Variable Text", "Segoe UI", "Aptos", Arial, sans-serif;
      font-size: 15px;
      font-weight: 380;
      letter-spacing: 0.003em;
      text-rendering: optimizeLegibility;
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
      margin-top: 0.82em;
    }

    .pw-export-document p {
      margin: 0;
      line-height: 1.82;
      color: var(--editor-text);
      font-weight: 370;
    }

    .pw-export-document h1 {
      margin: 1.08em 0 0.36em;
      font-size: 2em;
      font-weight: 650;
      line-height: 1.16;
      letter-spacing: -0.022em;
      color: var(--editor-heading);
      page-break-after: avoid;
    }

    .pw-export-document h2 {
      margin: 1.02em 0 0.3em;
      font-size: 1.5em;
      font-weight: 630;
      line-height: 1.24;
      letter-spacing: -0.016em;
      color: var(--editor-heading);
      page-break-after: avoid;
    }

    .pw-export-document h3 {
      margin: 0.98em 0 0.24em;
      font-size: 1.25em;
      font-weight: 620;
      line-height: 1.3;
      letter-spacing: -0.01em;
      color: var(--editor-heading-muted);
      page-break-after: avoid;
    }

    .pw-export-document h4,
    .pw-export-document h5,
    .pw-export-document h6 {
      margin: 0.92em 0 0.2em;
      font-size: 1.05em;
      font-weight: 610;
      line-height: 1.35;
      color: var(--editor-heading-muted);
      page-break-after: avoid;
    }

    .pw-export-document strong {
      color: var(--editor-heading);
      font-weight: 590;
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
      line-height: 1.8;
      margin-top: 0.2em;
    }

    .pw-export-document blockquote {
      margin: 0;
      padding-left: 1em;
      border-left: 3px solid var(--editor-blockquote-border);
      color: var(--editor-blockquote-text);
      font-style: italic;
      font-weight: 370;
    }

    .pw-export-document blockquote strong {
      font-weight: 560;
      color: inherit;
    }

    .pw-export-document hr {
      border: 0;
      border-top: 0.9px solid var(--editor-table-border);
      margin: 1.4em 0;
    }

    .pw-export-document code {
      font-family: ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace;
      font-size: 0.84em;
      background-color: var(--editor-code-bg);
      color: var(--editor-code-text);
      border-radius: 5px;
      padding: 0.08em 0.34em;
    }

    .pw-export-document .md-code-block-wrapper {
      position: relative;
      margin: 1.08em 0 1.24em;
      border: 0.9px solid var(--editor-codeblock-border);
      border-radius: 7px;
      overflow: hidden;
      background: var(--editor-codeblock-bg);
      box-shadow: 0 4px 10px -20px var(--editor-codeblock-shadow);
      break-inside: auto;
      page-break-inside: auto;
    }

    .pw-export-document .md-code-block-header {
      position: absolute;
      top: 0.56rem;
      right: 0.92rem;
      left: 0.92rem;
      z-index: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0.5rem;
      padding: 0;
      border: 0;
      background: transparent;
      page-break-after: avoid;
      break-after: avoid-page;
    }

    .pw-export-document .md-code-block-language {
      display: inline-flex;
      align-items: center;
      min-height: 1rem;
      padding: 0;
      color: var(--editor-codeblock-header-text);
      font-size: 0.66rem;
      font-weight: 500;
      letter-spacing: 0.06em;
      opacity: 0.78;
      line-height: 1;
      text-transform: uppercase;
    }

    .pw-export-document pre.md-code-block {
      margin: 0;
      overflow-x: hidden;
      padding: 1rem 0.96rem 0.94rem;
      background: transparent;
      border: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: normal;
      break-inside: auto;
      page-break-inside: auto;
    }

    .pw-export-document .md-code-block-wrapper-plain pre.md-code-block {
      padding-top: 2.45rem;
    }

    .pw-export-document pre.md-code-block code {
      display: block;
      font-family: Consolas, "Cascadia Mono", "SFMono-Regular", monospace;
      padding: 0;
      background: transparent;
      color: var(--editor-pre-code);
      border-radius: 0;
      font-size: 0.82rem;
      line-height: 1.62;
      letter-spacing: 0;
      font-weight: 400;
      text-rendering: optimizeLegibility;
      font-variant-ligatures: none;
      tab-size: 2;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: normal;
      orphans: 3;
      widows: 3;
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
      color: #0f8a63;
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
      color: #55657b;
      font-style: italic;
      opacity: 0.92;
    }

    .pw-export-document .hljs-deletion {
      color: var(--editor-syntax-deletion);
    }

    .pw-export-document .md-mermaid-preview {
      padding: 0.82rem 0.95rem 0.66rem;
      border-bottom: 0.9px solid var(--editor-codeblock-border);
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
      margin: 1.05em 0 1.18em;
      table-layout: fixed;
      page-break-inside: avoid;
    }

    .pw-export-document th,
    .pw-export-document td {
      border: 0.9px solid var(--editor-table-border);
      padding: 0.54em 0.72em;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }

    .pw-export-document th {
      background-color: var(--editor-table-header-bg);
      color: var(--editor-heading);
      font-weight: 680;
    }

    .pw-export-document td {
      background-color: var(--editor-table-cell-bg);
      color: var(--editor-text);
      font-weight: 380;
    }

    .pw-export-document td strong {
      font-weight: 500;
      color: inherit;
    }

    .pw-export-document td:first-child strong {
      font-weight: 450;
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

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Extension, mergeAttributes } from "@tiptap/core";
import type { MarkType } from "@tiptap/pm/model";
import {
  useEditor,
  EditorContent,
  type Editor,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { TableKit } from "@tiptap/extension-table";
import { Underline } from "@tiptap/extension-underline";
import { common, createLowlight } from "lowlight";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import type { BubbleCommandHandler } from "./bubbleMenuContract";
import type { ChatModelCatalogEntry } from "../../settings/settingsDefaults";
import { CanvasHighlight } from "../extensions/CanvasHighlight";
import {
  APP_EDITOR_CANVAS_APPLY_EVENT,
  type CanvasApplyPayload,
} from "../editorCommandEvents";
import type { CanvasChange } from "../../chat/canvasTypes";
import DiffMatchPatch from "diff-match-patch";

type MermaidApi = typeof import("mermaid").default;
const lowlight = createLowlight(common);

// Inserts a tab character when Tab is pressed outside list items and table cells.
// ListItem and Table extensions handle Tab in their own contexts with higher priority.
const TabIndent = Extension.create({
  name: "tabIndent",
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.insertContent("\t"),
    };
  },
});

let mermaidApiPromise: Promise<MermaidApi> | null = null;
let mermaidRenderCounter = 0;

function resolveMermaidTheme(): "default" | "dark" {
  if (typeof document === "undefined") return "default";
  const appShell = document.querySelector(".app-shell") as HTMLElement | null;
  const theme = appShell?.dataset.theme ?? "";
  return theme === "light" ? "default" : "dark";
}

async function getMermaidApi(): Promise<MermaidApi> {
  if (!mermaidApiPromise) {
    mermaidApiPromise = import("mermaid").then((module) => {
      const api = module.default;
      api.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: resolveMermaidTheme(),
      });
      return api;
    });
  }
  return mermaidApiPromise;
}

function decodeHtmlEntities(value: string): string {
  if (typeof document === "undefined") return value;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function isLikelyMermaidSyntaxLine(line: string): boolean {
  const value = line.trim();
  if (!value) return true;
  if (value.startsWith("%%")) return true;

  if (
    /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|xychart-beta|requirementDiagram|block-beta|C4\w+|subgraph|end|participant|actor|note|Note|loop|alt|opt|par|and|else|section|classDef|class|click|style|linkStyle|state|title|accTitle|accDescr|accDescrMultiline)\b/.test(
      value
    )
  ) {
    return true;
  }

  if (/(-->|==>|-.->|->>|-->>|::|:::|\[\*\]|[{}\[\]()])/.test(value)) {
    return true;
  }

  return false;
}

function sanitizeMermaidSource(rawValue: string): string {
  let value = decodeHtmlEntities(rawValue)
    .replace(/\r\n/g, "\n")
    .replace(/\\([\[\]#])/g, "$1");

  const fenceIndex = value.split("\n").findIndex((line) => line.trimStart().startsWith("```"));
  if (fenceIndex >= 0) {
    value = value.split("\n").slice(0, fenceIndex).join("\n");
  }

  const lines = value.split("\n");

  while (lines.length > 0) {
    const first = lines[0];
    if (!first.trim()) {
      lines.shift();
      continue;
    }
    if (isLikelyMermaidSyntaxLine(first)) {
      break;
    }
    lines.shift();
  }

  while (lines.length > 0) {
    const last = lines[lines.length - 1];
    if (!last.trim()) {
      lines.pop();
      continue;
    }
    if (isLikelyMermaidSyntaxLine(last)) {
      break;
    }
    lines.pop();
  }

  return lines.join("\n").trim();
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fallback below
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);
  return copied;
}

function CodeBlockNodeView({ node }: NodeViewProps) {
  const rawLanguage =
    typeof node.attrs.language === "string" ? node.attrs.language : "";
  const language = rawLanguage.trim().toLowerCase() || null;
  const isMermaid = language === "mermaid";

  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isRenderingMermaid, setIsRenderingMermaid] = useState(false);
  const [mermaidSvg, setMermaidSvg] = useState<string>("");
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const [activeMermaidTheme, setActiveMermaidTheme] = useState<"default" | "dark">(
    () => resolveMermaidTheme()
  );

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const appShell = document.querySelector(".app-shell") as HTMLElement | null;
    if (!appShell) return;

    const observer = new MutationObserver(() => {
      const nextTheme = resolveMermaidTheme();
      setActiveMermaidTheme((currentTheme) =>
        currentTheme === nextTheme ? currentTheme : nextTheme
      );
    });

    observer.observe(appShell, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isMermaid) {
      setIsRenderingMermaid(false);
      setMermaidSvg("");
      setMermaidError(null);
      return;
    }

    const source = sanitizeMermaidSource(node.textContent ?? "");
    if (!source) {
      setIsRenderingMermaid(false);
      setMermaidSvg("");
      setMermaidError("Mermaid vazio.");
      return;
    }

    let cancelled = false;

    const renderDiagram = async () => {
      setIsRenderingMermaid(true);
      setMermaidError(null);

      try {
        const mermaid = await getMermaidApi();
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          suppressErrorRendering: true,
          theme: activeMermaidTheme,
        });

        const renderId = `pw-mermaid-${++mermaidRenderCounter}`;
        const result = await mermaid.render(renderId, source);

        if (cancelled) return;

        setMermaidSvg(result.svg);
        setMermaidError(null);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Erro ao renderizar Mermaid.";
        setMermaidSvg("");
        setMermaidError(message);
      } finally {
        if (!cancelled) {
          setIsRenderingMermaid(false);
        }
      }
    };

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [isMermaid, node.textContent, activeMermaidTheme]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(node.textContent ?? "");
    if (!ok) return;

    setCopied(true);
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    copiedTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      copiedTimeoutRef.current = null;
    }, 1200);
  };

  return (
    <NodeViewWrapper
      className={`md-code-block-wrapper ${
        isMermaid ? "md-code-block-wrapper-mermaid" : "md-code-block-wrapper-plain"
      }`}
    >
      <div className="md-code-block-header" contentEditable={false}>
        {language && (
          <span className="md-code-block-language">
            {language.toUpperCase()}
          </span>
        )}
        <button
          type="button"
          className="md-code-copy-btn"
          aria-label="Copy code block"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleCopy();
          }}
        >
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {isMermaid && (
        <div className="md-mermaid-preview" contentEditable={false}>
          {isRenderingMermaid && (
            <div className="md-mermaid-status">Renderizando diagrama...</div>
          )}

          {!isRenderingMermaid && mermaidError && (
            <div className="md-mermaid-error">{mermaidError}</div>
          )}

          {!isRenderingMermaid && !mermaidError && mermaidSvg && (
            <div
              className="md-mermaid-canvas"
              dangerouslySetInnerHTML={{ __html: mermaidSvg }}
            />
          )}
        </div>
      )}

      {isMermaid ? (
        <details className="md-mermaid-source">
          <summary contentEditable={false}>Mermaid source</summary>
          <pre className="md-code-block md-code-block-mermaid-source" data-language={language}>
            <NodeViewContent className="language-mermaid" spellCheck={false} />
          </pre>
        </details>
      ) : (
        <pre className="md-code-block" data-language={language ?? undefined}>
          <NodeViewContent
            className={language ? `language-${language}` : undefined}
            spellCheck={false}
          />
        </pre>
      )}
    </NodeViewWrapper>
  );
}

const StyledCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: null,
        parseHTML: (element) => {
          const htmlElement = element as HTMLElement;
          const languageFromData = htmlElement.getAttribute("data-language");
          if (languageFromData) {
            return languageFromData;
          }

          const languageClassPrefix = this.options.languageClassPrefix;
          if (!languageClassPrefix) {
            return null;
          }

          const classNames = Array.from(
            htmlElement.firstElementChild?.classList ?? []
          );
          const languageClass = classNames.find((className) =>
            className.startsWith(languageClassPrefix)
          );
          return languageClass
            ? languageClass.slice(languageClassPrefix.length)
            : null;
        },
        renderHTML: (attributes) => {
          const language =
            typeof attributes.language === "string"
              ? attributes.language.trim().toLowerCase()
              : "";
          return language ? { "data-language": language } : {};
        },
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      [
        "code",
        {
          class: node.attrs.language
            ? `${this.options.languageClassPrefix}${node.attrs.language}`
            : null,
          spellcheck: "false",
        },
        0,
      ],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
});

// ─── Canvas apply helpers ────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWs(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Strip a ` ```markdown … ``` ` or ` ``` … ``` ` wrapper the AI may add. */
function stripMarkdownFence(content: string): string {
  const m = content.match(/^```(?:markdown)?\s*\n([\s\S]*?)\n```\s*$/i);
  return m ? m[1] : content;
}

/**
 * Split text into word-and-non-word tokens so that LCS diff operates at
 * the word (rather than character) level, keeping punctuation/spaces intact.
 */
function tokenize(text: string): string[] {
  return text.match(/\w+|[^\w]/g) ?? [];
}

interface WordOp {
  type: "equal" | "delete" | "insert" | "replace";
  /** Char offset inside the OLD paragraph text where this op begins. */
  textFrom: number;
  oldText: string;
  newText: string;
}

/** LCS-based word-level diff between two strings.  Returns ops in order. */
function computeWordDiff(oldText: string, newText: string): WordOp[] {
  const oldToks = tokenize(oldText);
  const newToks = tokenize(newText);
  const m = oldToks.length;
  const n = newToks.length;

  // Build cumulative char offsets for old tokens
  const oldCharPos: number[] = [];
  let cp = 0;
  for (const tok of oldToks) {
    oldCharPos.push(cp);
    cp += tok.length;
  }

  // LCS DP
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldToks[i - 1] === newToks[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack → raw entries
  type Raw =
    | { type: "old"; oldIdx: number }
    | { type: "new"; newTok: string }
    | { type: "equal"; oldIdx: number };

  const raw: Raw[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldToks[i - 1] === newToks[j - 1]) {
      raw.unshift({ type: "equal", oldIdx: i - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: "new", newTok: newToks[j - 1] });
      j--;
    } else {
      raw.unshift({ type: "old", oldIdx: i - 1 });
      i--;
    }
  }

  // Merge consecutive old/new runs → WordOps
  const result: WordOp[] = [];
  let ri = 0;
  let nextOldEnd = 0; // char offset past the last processed old token (for inserts)

  while (ri < raw.length) {
    const r = raw[ri];
    if (r.type === "equal") {
      const tok = oldToks[r.oldIdx];
      const from = oldCharPos[r.oldIdx];
      result.push({ type: "equal", textFrom: from, oldText: tok, newText: tok });
      nextOldEnd = from + tok.length;
      ri++;
    } else {
      // Collect a contiguous run of old/new tokens
      let runOld = "";
      let runNew = "";
      let runFrom = -1;

      while (ri < raw.length && raw[ri].type !== "equal") {
        const cur = raw[ri];
        if (cur.type === "old") {
          if (runFrom === -1) runFrom = oldCharPos[cur.oldIdx];
          runOld += oldToks[cur.oldIdx];
        } else if (cur.type === "new") {
          runNew += cur.newTok;
        }
        ri++;
      }

      if (runFrom === -1) runFrom = nextOldEnd; // pure insert

      if (runOld && runNew) {
        result.push({
          type: "replace",
          textFrom: runFrom,
          oldText: runOld,
          newText: runNew,
        });
      } else if (runOld) {
        result.push({
          type: "delete",
          textFrom: runFrom,
          oldText: runOld,
          newText: "",
        });
      } else {
        result.push({
          type: "insert",
          textFrom: runFrom,
          oldText: "",
          newText: runNew,
        });
      }
      nextOldEnd = runFrom + runOld.length;
    }
  }

  return result;
}

interface ParagraphDiffEntry {
  type: "equal" | "added" | "removed";
  old?: string;
  new?: string;
}

type ParagraphChange =
  | { type: "equal"; text: string }
  | { type: "replace"; oldText: string; newText: string }
  | { type: "delete"; oldText: string }
  | { type: "insert"; newText: string };

/**
 * Paragraph-level LCS diff.  Splits both documents by blank-line boundaries
 * and returns which paragraphs were added, removed, or unchanged.
 */
function diffParagraphs(
  oldContent: string,
  newContent: string
): ParagraphDiffEntry[] {
  const split = (s: string) =>
    s
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

  const oldParas = split(oldContent);
  const newParas = split(newContent);
  const m = oldParas.length;
  const n = newParas.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldParas[i - 1] === newParas[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: ParagraphDiffEntry[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldParas[i - 1] === newParas[j - 1]) {
      result.unshift({ type: "equal", old: oldParas[i - 1], new: newParas[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", new: newParas[j - 1] });
      j--;
    } else {
      result.unshift({ type: "removed", old: oldParas[i - 1] });
      i--;
    }
  }

  return result;
}

/**
 * Pairs up consecutive removed+added paragraph diff entries into "replace"
 * operations.  Orphan removed → delete; orphan added → insert.
 */
function mergeParagraphDiff(entries: ParagraphDiffEntry[]): ParagraphChange[] {
  const result: ParagraphChange[] = [];
  let i = 0;
  while (i < entries.length) {
    const e = entries[i];
    if (e.type === "equal") {
      result.push({ type: "equal", text: e.old! });
      i++;
    } else if (
      e.type === "removed" &&
      i + 1 < entries.length &&
      entries[i + 1].type === "added"
    ) {
      result.push({ type: "replace", oldText: e.old!, newText: entries[i + 1].new! });
      i += 2;
    } else if (e.type === "removed") {
      result.push({ type: "delete", oldText: e.old! });
      i++;
    } else {
      result.push({ type: "insert", newText: e.new! });
      i++;
    }
  }
  return result;
}

/** Find the PM content range of a paragraph whose text matches `text`. */
function findParagraphInDoc(
  doc: import("@tiptap/pm/model").Node,
  text: string
): { from: number; to: number } | null {
  const norm = normalizeWs(text);
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.isTextblock && normalizeWs(node.textContent) === norm) {
      found = { from: pos + 1, to: pos + 1 + node.content.size };
      return false;
    }
  });
  return found;
}

/**
 * Instant (no animation) apply of `newContent` to the editor, then sweep
 * highlight marks onto changed paragraphs one by one (110 ms apart).
 * Used as a fallback for very large or structurally complex edits.
 */
function doInstantApply(
  editor: Editor,
  newContent: string,
  paraEntries: ParagraphDiffEntry[],
  isMarkdown: boolean
): void {
  if (isMarkdown) {
    const mm = editor.markdown;
    if (!mm) return;
    editor.commands.setContent(mm.parse(newContent), { emitUpdate: true });
  } else {
    editor.commands.setContent(newContent, { emitUpdate: true });
  }

  const addedSet = new Set(
    paraEntries
      .filter((e) => e.type === "added" && e.new)
      .map((e) => normalizeWs(e.new!))
  );
  if (addedSet.size === 0) return;

  const markType = editor.schema.marks["canvasHighlight"] as MarkType | undefined;
  if (!markType) return;

  const positions: Array<{ from: number; to: number }> = [];
  const used = new Set<number>();
  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const text = normalizeWs(node.textContent);
    if (text && addedSet.has(text) && !used.has(pos)) {
      used.add(pos);
      positions.push({ from: pos + 1, to: pos + 1 + node.content.size });
    }
  });

  positions.forEach(({ from, to }, idx) => {
    setTimeout(() => {
      const mt = editor.schema.marks["canvasHighlight"] as MarkType | undefined;
      if (!mt) return;
      editor.view.dispatch(editor.state.tr.addMark(from, to, mt.create()));
    }, idx * 110);
  });
}

// ── Canvas structured-diff helpers ───────────────────────────────────────────

const BLOCK_SEPARATOR = "\n\n";

/** Builds an array mapping each plain-text offset to its ProseMirror position.
 *  Block boundaries are represented as BLOCK_SEPARATOR (\n\n), consistent with
 *  editor.getText({ blockSeparator: '\n\n' }). */
function buildOffsetMapping(editor: Editor): number[] {
  const { doc } = editor.state;
  const mapping: number[] = [];
  let isFirstBlock = true;

  doc.descendants((node, pos) => {
    if (node.isBlock && node.isTextblock) {
      if (!isFirstBlock) {
        // Both chars of the \n\n separator map to the start of the current block
        for (let s = 0; s < BLOCK_SEPARATOR.length; s++) {
          mapping.push(pos);
        }
      }
      isFirstBlock = false;
      return; // descend into children
    }

    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        mapping.push(pos + i);
      }
    }
  });

  return mapping;
}

/** Converts a plain-text offset to a ProseMirror document position {from, to}
 *  spanning `length` characters, using the pre-built offset mapping. */
function textOffsetToDocPos(
  editor: Editor,
  textOffset: number,
  length: number
): { from: number; to: number } | null {
  const mapping = buildOffsetMapping(editor);

  if (textOffset < 0 || textOffset >= mapping.length) return null;

  const from = mapping[textOffset];

  if (length === 0) return { from, to: from };

  const endOffset = textOffset + length;
  const to =
    endOffset < mapping.length
      ? mapping[endOffset]
      : mapping[mapping.length - 1] + 1;

  return { from, to };
}

interface ResolvedChange {
  from: number;
  to: number;
  corrected: string;
}

/** Runs a full diff-match-patch between the current editor plain text and
 *  `correctedDocument`, returning all changed spans as ProseMirror positions. */
function resolveViaFullDiff(
  editor: Editor,
  correctedDocument: string
): ResolvedChange[] {
  const dmp = new DiffMatchPatch();

  // Uses the same separator as buildOffsetMapping
  const originalText = editor.getText({ blockSeparator: BLOCK_SEPARATOR });

  const diffs = dmp.diff_main(originalText, correctedDocument);
  dmp.diff_cleanupSemantic(diffs);

  const changes: ResolvedChange[] = [];
  let offset = 0;
  let i = 0;

  const EQUAL = 0, DELETE = -1, INSERT = 1;

  while (i < diffs.length) {
    const [op, text] = diffs[i];

    if (op === EQUAL) {
      offset += text.length;
      i++;
      continue;
    }

    if (op === DELETE) {
      const next = diffs[i + 1];
      if (next && next[0] === INSERT) {
        // Substituição: DELETE seguido de INSERT
        const pos = textOffsetToDocPos(editor, offset, text.length);
        if (pos) {
          changes.push({ from: pos.from, to: pos.to, corrected: next[1] });
        }
        offset += text.length;
        i += 2;
        continue;
      } else {
        // Deleção pura
        const pos = textOffsetToDocPos(editor, offset, text.length);
        if (pos) {
          changes.push({ from: pos.from, to: pos.to, corrected: "" });
        }
        offset += text.length;
        i++;
        continue;
      }
    }

    if (op === INSERT) {
      // Inserção pura (sem DELETE anterior)
      const pos = textOffsetToDocPos(editor, offset, 0);
      if (pos) {
        changes.push({ from: pos.from, to: pos.from, corrected: text });
      }
      i++;
      continue;
    }

    i++;
  }

  return changes;
}

/** Resolves the ProseMirror position of a CanvasChange's `original` text using
 *  a cascade of strategies: context anchoring → before anchor → occurrence index
 *  → first occurrence as last resort. Returns null if the text is not found. */
// @ts-ignore — kept for re-enablement when context anchoring is restored
function resolveChangePosition(
  editor: Editor,
  change: CanvasChange
): { from: number; to: number } | null {
  const fullText = editor.getText();
  const { original, context, occurrences } = change;

  if (!fullText.includes(change.original)) {
    console.warn(
      `[Canvas] original não encontrado exato: "${change.original}"\n` +
      `Contexto esperado antes: "${change.context.before}"\n` +
      `Contexto esperado depois: "${change.context.after}"`
    );
    return null;
  }

  // Collect all positions of original in the plain text
  const allPositions: number[] = [];
  let searchFrom = 0;
  while (true) {
    const idx = fullText.indexOf(original, searchFrom);
    if (idx === -1) break;
    allPositions.push(idx);
    searchFrom = idx + 1;
  }

  if (allPositions.length === 0) return null;

  // Strategy 1: context anchoring (before + original + after)
  const withContext = context.before + original + context.after;
  const ctxIdx = fullText.indexOf(withContext);
  if (ctxIdx !== -1) {
    return textOffsetToDocPos(editor, ctxIdx + context.before.length, original.length);
  }

  // Strategy 2: before anchor only
  if (context.before) {
    const beforeIdx = fullText.indexOf(context.before + original);
    if (beforeIdx !== -1) {
      return textOffsetToDocPos(editor, beforeIdx + context.before.length, original.length);
    }
  }

  // Strategy 3: occurrence index
  const targetIndexes: number[] =
    occurrences === "all"
      ? allPositions.map((_, i) => i)
      : (occurrences as number[]).map((n) => n - 1);

  const validIdx = targetIndexes.find((i) => i >= 0 && i < allPositions.length);
  if (validIdx !== undefined) {
    return textOffsetToDocPos(editor, allPositions[validIdx], original.length);
  }

  // Strategy 4: first occurrence as last resort
  return textOffsetToDocPos(editor, allPositions[0], original.length);
}

/** Applies a single replacement at `position` with char-by-char animation and
 *  canvasHighlight marks on every inserted character. */
async function applyAnimatedChange(
  editor: Editor,
  position: { from: number; to: number },
  newText: string
): Promise<void> {
  const oldLength = position.to - position.from;
  const totalChars = oldLength + newText.length;
  const delMs = totalChars > 500 ? 4 : totalChars > 200 ? 8 : 13;
  const insMs = totalChars > 500 ? 7 : totalChars > 200 ? 14 : 24;

  const markType = editor.schema.marks["canvasHighlight"] as MarkType | undefined;

  // Scroll to the target position
  editor.commands.setTextSelection(position);

  // DELETE char by char from the LEFT (position.from is stable as chars are removed)
  for (let k = 0; k < oldLength; k++) {
    editor.view.dispatch(
      editor.state.tr.delete(position.from, position.from + 1)
    );
    await sleep(delMs);
  }

  // INSERT char by char from the LEFT
  for (let k = 0; k < newText.length; k++) {
    await sleep(insMs);
    const at = position.from + k;
    const tr = editor.state.tr.insertText(newText[k], at);
    if (markType) tr.addMark(at, at + 1, markType.create());
    editor.view.dispatch(tr);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

interface TipTapEditorProps {
  documentId?: string | null;
  content?: string;
  onContentChange?: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  bubbleDefaultModel?: ChatModelCatalogEntry | null;
  onBubbleCommand?: BubbleCommandHandler;
  readOnly?: boolean;
  contentType?: "html" | "markdown";
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

export function TipTapEditor({
  documentId = null,
  content = "",
  onContentChange,
  onEditorReady,
  bubbleDefaultModel = null,
  onBubbleCommand,
  readOnly = false,
  contentType = "html",
  scrollContainerRef,
}: TipTapEditorProps) {
  const isMarkdownContent = contentType === "markdown";

  const scrollContainerToBoundary = useCallback(
    (boundary: "start" | "end") => {
      const container = scrollContainerRef?.current;
      if (!container) return;

      if (boundary === "start") {
        container.scrollTo({ top: 0 });
        return;
      }

      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      container.scrollTo({ top: maxScroll });
    },
    [scrollContainerRef]
  );

  const scheduleScrollContainerToBoundary = useCallback(
    (boundary: "start" | "end") => {
      const applyScroll = () => {
        scrollContainerToBoundary(boundary);
      };

      window.requestAnimationFrame(() => {
        applyScroll();
        // Run twice to override delayed internal scroll adjustments from ProseMirror.
        window.requestAnimationFrame(applyScroll);
      });
    },
    [scrollContainerToBoundary]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      StyledCodeBlock.configure({
        lowlight,
        languageClassPrefix: "language-",
        HTMLAttributes: {
          class: "md-code-block",
        },
      }),
      TableKit,
      Underline,
      TabIndent,
      CanvasHighlight,
      Markdown.configure({
        markedOptions: {
          gfm: true,
          breaks: false,
        },
      }),
    ],
    content: isMarkdownContent ? "" : content,
    editable: !readOnly,
    shouldRerenderOnTransaction: false,
    onUpdate({ editor: updatedEditor }) {
      onContentChange?.(
        isMarkdownContent
          ? updatedEditor.getMarkdown()
          : updatedEditor.getHTML()
      );
    },
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    const nextContent = content ?? "";
    const focusAtStart = () => {
      if (readOnly) return;
      editor.commands.focus("start");
    };

    if (isMarkdownContent) {
      const current = editor.getMarkdown();
      if (current === nextContent) return;

      const markdownManager = editor.markdown;
      if (!markdownManager) return;

      const parsed = markdownManager.parse(nextContent);
      editor.commands.setContent(parsed, { emitUpdate: false });
      focusAtStart();
      return;
    }

    const current = editor.getHTML();
    if (current !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
      focusAtStart();
    }
  }, [editor, content, isMarkdownContent, readOnly]);

  useEffect(() => {
    if (!editor || readOnly) return;

    const rafId = window.requestAnimationFrame(() => {
      editor.commands.focus("start");
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [editor, documentId, readOnly]);

  useEffect(() => {
    if (!editor || readOnly || !isMarkdownContent) return;

    const handleBoundaryNavigation = (event: KeyboardEvent) => {
      const hasBoundaryModifier = event.ctrlKey || event.metaKey;
      if (!hasBoundaryModifier || event.altKey) return;
      if (event.key !== "Home" && event.key !== "End") return;

      event.preventDefault();

      const isHome = event.key === "Home";
      editor.commands.focus(isHome ? "start" : "end", {
        scrollIntoView: false,
      });
      scheduleScrollContainerToBoundary(isHome ? "start" : "end");
    };

    const dom = editor.view.dom;
    dom.addEventListener("keydown", handleBoundaryNavigation, true);

    return () => {
      dom.removeEventListener("keydown", handleBoundaryNavigation, true);
    };
  }, [editor, readOnly, isMarkdownContent, scheduleScrollContainerToBoundary]);

  // ── Canvas apply ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editor || readOnly) return;

    const handleCanvasApply = (event: Event) => {
      void (async () => {
        const { documentId: eventDocId, newContent, canvasDiff, anchorStrategy } = (
          event as CustomEvent<CanvasApplyPayload>
        ).detail;

        if (eventDocId !== documentId) return;
        if (!newContent?.trim()) return;

        // ── CAMINHO ESTRUTURADO (novo) ──────────────────────────────────────
        if (canvasDiff && canvasDiff.changes.length > 0) {
          const resolved: ResolvedChange[] = [];
          const coveredRanges: { from: number; to: number }[] = [];

          // ── Tier A: context anchoring primeiro ─────────────────────────
          if (anchorStrategy === "anchoring") {
            for (const change of canvasDiff.changes) {
              const position = resolveChangePosition(editor, change);
              if (position) {
                resolved.push({ ...position, corrected: change.corrected });
                coveredRanges.push(position);
              }
            }
          }

          // ── Todos os tiers: DMP cobre o que o anchoring não resolveu ───
          if (canvasDiff.correctedDocument) {
            const sanitizedDoc = canvasDiff.correctedDocument
              .replace(/^---\n?/m, "")
              .replace(/\n?---$/m, "")
              .replace(/^```[\w]*\n?/m, "")
              .replace(/\n?```$/m, "")
              .trim();

            const dmpChanges = resolveViaFullDiff(editor, sanitizedDoc);

            for (const dmpChange of dmpChanges) {
              const alreadyCovered = coveredRanges.some(
                (r) => r.from < dmpChange.to && r.to > dmpChange.from
              );
              if (!alreadyCovered) {
                resolved.push(dmpChange);
              }
            }
          }

          if (resolved.length > 0) {
            resolved.sort((a, b) => b.from - a.from);
            for (const item of resolved) {
              await applyAnimatedChange(editor, item, item.corrected);
              await sleep(300);
            }
            return;
          }
          // Se nenhuma posição foi resolvida, cai no caminho legado abaixo
        }

        // ── CAMINHO LEGADO (fallback) ───────────────────────────────────────
        const stripped = stripMarkdownFence(newContent.trim());
        const oldContent = isMarkdownContent
          ? editor.getMarkdown()
          : editor.getHTML();

        if (normalizeWs(oldContent) === normalizeWs(stripped)) return;

        // ── Paragraph-level diff ──────────────────────────────────────────
        const paraEntries = diffParagraphs(oldContent, stripped);
        const paraChanges = mergeParagraphDiff(paraEntries);

        const totalChangedChars = paraChanges.reduce((s, p) => {
          if (p.type === "replace") return s + p.oldText.length + p.newText.length;
          if (p.type === "delete") return s + p.oldText.length;
          if (p.type === "insert") return s + p.newText.length;
          return s;
        }, 0);

        // Fallback for very large edits or structural adds/deletes
        const hasStructural = paraChanges.some(
          (p) => p.type === "insert" || p.type === "delete"
        );

        if (totalChangedChars > 3000 || hasStructural) {
          doInstantApply(editor, stripped, paraEntries, isMarkdownContent);
          return;
        }

        // ── Word-level animated apply ─────────────────────────────────────
        // Collect only "replace" ops and find their positions in the
        // current document BEFORE starting any animations.
        type Positioned = {
          oldText: string;
          newText: string;
          paraFrom: number;
        };

        const positioned: Positioned[] = [];
        for (const change of paraChanges) {
          if (change.type !== "replace") continue;
          const pos = findParagraphInDoc(editor.state.doc, change.oldText);
          if (!pos) continue;
          positioned.push({
            oldText: change.oldText,
            newText: change.newText,
            paraFrom: pos.from,
          });
        }

        if (positioned.length === 0) return;

        // Sort RIGHT-TO-LEFT so earlier changes don't shift later positions
        positioned.sort((a, b) => b.paraFrom - a.paraFrom);

        // Speed adapts to total chars so long edits don't drag
        const totalWordChars = positioned.reduce(
          (s, p) => s + p.oldText.length + p.newText.length,
          0
        );
        const delMs = totalWordChars > 500 ? 4 : totalWordChars > 200 ? 8 : 13;
        const insMs = totalWordChars > 500 ? 7 : totalWordChars > 200 ? 14 : 24;

        const markType = editor.schema.marks[
          "canvasHighlight"
        ] as MarkType | undefined;

        for (const { oldText, newText, paraFrom } of positioned) {
          const wordOps = computeWordDiff(oldText, newText);
          // Word ops processed RIGHT-TO-LEFT within the paragraph
          const changing = wordOps
            .filter((op) => op.type !== "equal")
            .reverse();

          for (const op of changing) {
            const pmFrom = paraFrom + op.textFrom;

            // ── Delete old text: backspace from the END ──────────────────
            for (let k = op.oldText.length - 1; k >= 0; k--) {
              await sleep(delMs);
              editor.view.dispatch(
                editor.state.tr.delete(pmFrom + k, pmFrom + k + 1)
              );
            }

            // ── Insert new text: type char by char from the LEFT ─────────
            for (let k = 0; k < op.newText.length; k++) {
              await sleep(insMs);
              const at = pmFrom + k;
              const tr = editor.state.tr.insertText(op.newText[k], at);
              if (markType) tr.addMark(at, at + 1, markType.create());
              editor.view.dispatch(tr);
            }
          }
        }
      })();
    };

    window.addEventListener(APP_EDITOR_CANVAS_APPLY_EVENT, handleCanvasApply);
    return () =>
      window.removeEventListener(APP_EDITOR_CANVAS_APPLY_EVENT, handleCanvasApply);
  }, [editor, documentId, readOnly, isMarkdownContent]);
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-full flex-col w-full">
      <EditorContent
        editor={editor}
        className="tiptap-body w-full min-h-full px-6 py-8 text-base leading-relaxed sm:px-8 sm:py-10"
      />
      {!readOnly && editor && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: e }) => {
            const { from, to } = e.state.selection;
            return (
              from !== to &&
              e.state.doc.textBetween(from, to).trim().length > 0
            );
          }}
        >
          <EditorBubbleMenu
            editor={editor}
            defaultModel={bubbleDefaultModel}
            onBubbleCommand={onBubbleCommand}
          />
        </BubbleMenu>
      )}
    </div>
  );
}

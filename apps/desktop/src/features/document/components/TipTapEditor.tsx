import { useEffect, useRef, useState } from "react";
import { mergeAttributes } from "@tiptap/core";
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
import { CodeBlock } from "@tiptap/extension-code-block";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import type { BubbleCommandHandler } from "./bubbleMenuContract";

type MermaidApi = typeof import("mermaid").default;

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
    <NodeViewWrapper className="md-code-block-wrapper">
      <div className="md-code-block-header" contentEditable={false}>
        <span className="md-code-block-language">
          {language ? language.toUpperCase() : "CODE"}
        </span>
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
          <span className="md-code-copy-icon" aria-hidden>
            ⧉
          </span>
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

const StyledCodeBlock = CodeBlock.extend({
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

interface TipTapEditorProps {
  content?: string;
  onContentChange?: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  onBubbleCommand?: BubbleCommandHandler;
  readOnly?: boolean;
  contentType?: "html" | "markdown";
}

export function TipTapEditor({
  content = "",
  onContentChange,
  onEditorReady,
  onBubbleCommand,
  readOnly = false,
  contentType = "html",
}: TipTapEditorProps) {
  const isMarkdownContent = contentType === "markdown";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      StyledCodeBlock.configure({
        languageClassPrefix: "language-",
        HTMLAttributes: {
          class: "md-code-block",
        },
      }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      TableKit,
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

    if (isMarkdownContent) {
      const current = editor.getMarkdown();
      if (current === nextContent) return;

      const markdownManager = editor.markdown;
      if (!markdownManager) return;

      const parsed = markdownManager.parse(nextContent);
      editor.commands.setContent(parsed, { emitUpdate: false });
      return;
    }

    const current = editor.getHTML();
    if (current !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [editor, content, isMarkdownContent]);

  return (
    <div className="flex min-h-full flex-col w-full">
      <EditorContent
        editor={editor}
        className="tiptap-body w-full min-h-[500px] text-base leading-relaxed"
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
            onBubbleCommand={onBubbleCommand}
          />
        </BubbleMenu>
      )}
    </div>
  );
}

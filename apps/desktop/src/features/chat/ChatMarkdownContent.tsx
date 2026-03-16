import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { TableKit } from "@tiptap/extension-table";
import { Underline } from "@tiptap/extension-underline";
import { common, createLowlight } from "lowlight";

interface ChatMarkdownContentProps {
  content: string;
}

const lowlight = createLowlight(common);

const chatMarkdownExtensions = [
  StarterKit.configure({ codeBlock: false }),
  CodeBlockLowlight.configure({
    lowlight,
    languageClassPrefix: "language-",
    HTMLAttributes: {
      class: "md-code-block",
    },
  }),
  TableKit,
  Underline,
  Markdown.configure({
    markedOptions: {
      gfm: true,
      breaks: false,
    },
  }),
];

export function ChatMarkdownContent({ content }: ChatMarkdownContentProps) {
  const editor = useEditor({
    extensions: chatMarkdownExtensions,
    content: "",
    editable: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        spellcheck: "false",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const markdownManager = editor.markdown;
    if (!markdownManager) return;

    const parsed = markdownManager.parse(content ?? "");
    editor.commands.setContent(parsed, { emitUpdate: false });
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="whitespace-pre-wrap break-words">
        {content}
      </div>
    );
  }

  return (
    <div className="chat-markdown tiptap-body break-words">
      <EditorContent editor={editor} />
    </div>
  );
}

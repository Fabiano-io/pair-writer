import type { Editor } from "@tiptap/react";

function tryExecCommand(command: "copy" | "cut" | "paste"): boolean {
  try {
    return document.execCommand(command);
  } catch {
    return false;
  }
}

async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Ignore clipboard permission failures and allow fallback paths.
  }

  return false;
}

async function readClipboardText(): Promise<string | null> {
  try {
    if (navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {
    // Ignore clipboard permission failures and allow fallback paths.
  }

  return null;
}

function getEditorSelection(editor: Editor): {
  from: number;
  to: number;
  text: string;
} | null {
  const { from, to } = editor.state.selection;
  if (from === to) return null;

  const text = editor.state.doc.textBetween(from, to, "\n");
  return { from, to, text };
}

export async function copyEditorSelection(editor: Editor): Promise<void> {
  const selection = getEditorSelection(editor);
  if (!selection) return;

  const wrote = await writeClipboardText(selection.text);
  if (wrote) return;

  editor.chain().focus().run();
  tryExecCommand("copy");
}

export async function cutEditorSelection(editor: Editor): Promise<void> {
  const selection = getEditorSelection(editor);
  if (!selection) return;

  const wrote = await writeClipboardText(selection.text);
  if (wrote) {
    editor.chain().focus().deleteSelection().run();
    return;
  }

  editor.chain().focus().run();
  tryExecCommand("cut");
}

export async function pasteIntoEditor(editor: Editor): Promise<void> {
  const text = await readClipboardText();
  if (text !== null) {
    editor.chain().focus().insertContent(text).run();
    return;
  }

  editor.chain().focus().run();
  tryExecCommand("paste");
}

export async function copyTextareaSelection(
  textarea: HTMLTextAreaElement
): Promise<void> {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  if (start === end) return;

  const text = textarea.value.slice(start, end);
  const wrote = await writeClipboardText(text);
  if (wrote) return;

  textarea.focus();
  tryExecCommand("copy");
}

export async function cutTextareaSelection(
  textarea: HTMLTextAreaElement,
  onValueChange: (next: string) => void
): Promise<void> {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  if (start === end) return;

  const text = textarea.value.slice(start, end);
  const wrote = await writeClipboardText(text);

  if (wrote) {
    const next = `${textarea.value.slice(0, start)}${textarea.value.slice(end)}`;
    onValueChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start);
    });
    return;
  }

  textarea.focus();
  tryExecCommand("cut");
}

export async function pasteIntoTextarea(
  textarea: HTMLTextAreaElement,
  onValueChange: (next: string) => void
): Promise<void> {
  const text = await readClipboardText();
  if (text === null) {
    textarea.focus();
    tryExecCommand("paste");
    return;
  }

  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const next = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;

  onValueChange(next);

  requestAnimationFrame(() => {
    const caret = start + text.length;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  });
}

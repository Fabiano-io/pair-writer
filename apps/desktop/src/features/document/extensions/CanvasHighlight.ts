import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * Transient mark applied to document sections that were changed by a Canvas
 * mode edit. The mark is purely visual — it does not survive markdown
 * serialisation and is never written to the file on disk.
 */
export const CanvasHighlight = Mark.create({
  name: "canvasHighlight",
  priority: 1000,
  keepOnSplit: false,
  inclusive: false,
  excludes: "",

  parseHTML() {
    return [{ tag: "mark.canvas-highlight" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "mark",
      mergeAttributes({ class: "canvas-highlight" }, HTMLAttributes),
      0,
    ];
  },
});

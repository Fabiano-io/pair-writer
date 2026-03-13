import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => {
    const hidden = element.getAttribute("aria-hidden") === "true";
    const disabled = element.hasAttribute("disabled");
    return !hidden && !disabled;
  });
}

interface DialogA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function useDialogA11y({
  isOpen,
  onClose,
  initialFocusRef,
}: DialogA11yOptions) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusInitialTarget = () => {
      const target =
        initialFocusRef?.current ?? getFocusableElements(dialog)[0] ?? dialog;
      target.focus();
    };

    const rafId = window.requestAnimationFrame(focusInitialTarget);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      if (event.shiftKey) {
        if (!activeElement || activeElement === first || !dialog.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!activeElement || activeElement === last || !dialog.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusedElement?.focus();
    };
  }, [isOpen, onClose, initialFocusRef]);

  return dialogRef;
}


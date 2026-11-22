import { useEffect } from 'react';

export interface Shortcut {
  /** Single character key (case-insensitive) or special key like 'Escape'. */
  key: string;
  handler: (e: KeyboardEvent) => void;
  /** Human-readable description for help dialogs. */
  description?: string;
  /** Allow firing while typing in an input/textarea/contentEditable. Default false. */
  allowInInput?: boolean;
  /** Required modifier. Default: none. */
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

const isEditableTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
};

/**
 * Register lightweight global keyboard shortcuts. Shortcuts are scoped to the
 * lifetime of the calling component. By default they are ignored while the
 * user is typing in an input/textarea/contentEditable element.
 */
export const useKeyboardShortcuts = (shortcuts: Shortcut[]) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inEditable = isEditableTarget(e.target);
      for (const s of shortcuts) {
        if (inEditable && !s.allowInInput) continue;
        if (!!s.ctrl !== e.ctrlKey) continue;
        if (!!s.meta !== e.metaKey) continue;
        if (!!s.shift !== e.shiftKey) continue;
        if (!!s.alt !== e.altKey) continue;
        const matches =
          s.key.length === 1
            ? e.key.toLowerCase() === s.key.toLowerCase()
            : e.key === s.key;
        if (matches) {
          e.preventDefault();
          s.handler(e);
          break;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts]);
};

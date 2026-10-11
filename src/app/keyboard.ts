// キー操作。入力欄と開いている dialog の中では効かない。
// ボタンやリンクにフォーカスがあるときは Space と Enter を奪わない（ボタン自身が使う）。
import { useEffect, useRef } from 'react';

export interface KeyActions {
  togglePlay(): void;
  prevStep(): void;
  nextStep(): void;
  /** 秒。負なら戻す */
  nudge(sec: number): void;
  home(): void;
  end(): void;
  /** 0 始まり */
  pickStyle(i: number): void;
  toggleTheme(): void;
  openExport(): void;
  copyUrl(): void;
  openHelp(): void;
  close(): void;
}

export const FRAME_SEC = 1 / 30;

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLElement && el.isContentEditable;
}

function isActivatable(el: Element | null): boolean {
  return el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || (el instanceof HTMLElement && el.getAttribute('role') === 'tab');
}

function insideOpenDialog(el: Element | null): boolean {
  return !!el?.closest('dialog[open]');
}

/** 1 回の keydown を動作に割り当てる。動作しなかったら false を返す。 */
export function dispatchKey(e: KeyboardEvent, a: KeyActions): boolean {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return false;
  const target = e.target instanceof Element ? e.target : null;
  if (isEditable(target) || insideOpenDialog(target)) return false;
  const onButton = isActivatable(target);

  switch (e.key) {
    case ' ':
      if (onButton) return false;
      a.togglePlay();
      return true;
    case 'Enter':
      return false;
    case 'k':
    case 'K':
      a.togglePlay();
      return true;
    case 'ArrowLeft':
      if (e.shiftKey) a.nudge(-1);
      else a.prevStep();
      return true;
    case 'ArrowRight':
      if (e.shiftKey) a.nudge(1);
      else a.nextStep();
      return true;
    case ',':
      a.nudge(-FRAME_SEC);
      return true;
    case '.':
      a.nudge(FRAME_SEC);
      return true;
    case 'Home':
      a.home();
      return true;
    case 'End':
      a.end();
      return true;
    case '1':
    case '2':
    case '3':
    case '4':
      a.pickStyle(Number(e.key) - 1);
      return true;
    case 'd':
    case 'D':
      a.toggleTheme();
      return true;
    case 'e':
    case 'E':
      a.openExport();
      return true;
    case 's':
    case 'S':
      a.copyUrl();
      return true;
    case '?':
      a.openHelp();
      return true;
    case 'Escape':
      a.close();
      return true;
    default:
      return false;
  }
}

export function useShellKeys(actions: KeyActions): void {
  const ref = useRef(actions);
  useEffect(() => {
    ref.current = actions;
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (dispatchKey(e, ref.current)) e.preventDefault();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

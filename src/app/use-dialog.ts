// <dialog> の showModal / close を open 状態に同期する。Esc で閉じたときも onClose を呼ぶ。
import { useEffect, useRef, type RefObject } from 'react';

export function useDialog(open: boolean, onClose: () => void): RefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onCloseRef.current();
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, []);

  return ref;
}

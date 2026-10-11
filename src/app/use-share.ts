import { useCallback, useEffect, useRef, useState } from 'react';

export type ShareStatus = 'idle' | 'copied' | 'failed';

const SHOW_MS = 2000;

/** URL をクリップボードに写す。2 秒だけ「コピーした」を出し、書けなければ URL を見せる。 */
export function useShare(getUrl: () => string) {
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [url, setUrl] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async () => {
    const u = getUrl();
    setUrl(u);
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(u);
      setStatus('copied');
      timer.current = setTimeout(() => setStatus('idle'), SHOW_MS);
    } catch {
      setStatus('failed');
    }
  }, [getUrl]);

  const dismiss = useCallback(() => setStatus('idle'), []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { status, url, copy, dismiss };
}

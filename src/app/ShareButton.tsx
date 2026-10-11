import { useEffect, useRef } from 'react';
import { S } from './strings';
import type { ShareStatus } from './use-share';

export interface ShareButtonProps {
  status: ShareStatus;
  url: string;
  onCopy: () => void;
}

export function ShareButton({ status, url, onCopy }: ShareButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (status === 'failed') input.current?.select();
  }, [status]);

  return (
    <span className="share">
      <button type="button" className="ui-btn" onClick={onCopy}>
        {S.nav.share}
      </button>
      <span className="ui-status" role="status" aria-live="polite">
        {status === 'copied' ? S.share.copied : status === 'failed' ? S.share.failed : ''}
      </span>
      {status === 'failed' && (
        <input ref={input} className="dlg__input share__url" type="text" readOnly value={url} aria-label={S.share.urlLabel} />
      )}
    </span>
  );
}

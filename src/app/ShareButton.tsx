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
      <span className="share__pop" role="status" aria-live="polite">
        {status === 'copied' && <span className="ui-status">{S.share.copied}</span>}
        {status === 'failed' && (
          <>
            <span className="ui-status">{S.share.failed}</span>
            <input ref={input} className="dlg__input share__url" type="text" readOnly value={url} aria-label={S.share.urlLabel} />
          </>
        )}
      </span>
    </span>
  );
}

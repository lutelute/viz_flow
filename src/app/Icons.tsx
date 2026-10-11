// 操作ボタンの記号。絵文字は使わず、16px の単純な図形にする。

export function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 2.5v11l9-5.5z" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="2.5" width="3" height="11" />
      <rect x="9.5" y="2.5" width="3" height="11" />
    </svg>
  );
}

export function PrevIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="2.5" width="2" height="11" />
      <path d="M13 2.5 6.5 8 13 13.5z" />
    </svg>
  );
}

export function NextIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="11" y="2.5" width="2" height="11" />
      <path d="M3 2.5 9.5 8 3 13.5z" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

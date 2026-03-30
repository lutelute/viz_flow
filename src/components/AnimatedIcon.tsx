/**
 * アイコンの動作分類:
 *
 * 【静的】アクセスポイント・ストレージ — アニメなし
 *   database, server, cloud, layers, file-input, box, lock
 *
 * 【動的】AI/計算 — 輝き・パルス
 *   sparkles: 星がきらめく
 *   brain: 思考パルス
 *   cpu: 回転ギア風
 *
 * 【動的】人間動作 — 呼吸・モーション
 *   user/users: 上下バウンス
 *   search: 探索揺れ
 *   eye: まばたき
 *
 * 【動的】フロー制御 — 回転・シャッフル
 *   shuffle: 回転
 *   filter: パルス
 *   target: 照準パルス
 *   lightbulb: 点滅
 */

import { getIconPath } from '../utils/icons';

// 動作系アイコンの分類
const ANIM_TYPE: Record<string, 'pulse' | 'sparkle' | 'spin' | 'bounce' | 'blink'> = {
  // AI / 計算系 → sparkle (きらめき)
  sparkles: 'sparkle',
  brain: 'sparkle',

  // 処理系 → pulse
  cpu: 'pulse',
  filter: 'pulse',
  target: 'pulse',
  zap: 'pulse',
  settings: 'spin',

  // 人間操作系 → bounce
  user: 'bounce',
  users: 'bounce',
  search: 'bounce',
  eye: 'blink',

  // フロー制御 → spin
  shuffle: 'spin',

  // アイデア → blink
  lightbulb: 'blink',
  rocket: 'pulse',
};

interface Props {
  icon: string;
  size: number;
  color: string;
  muted?: boolean;
  nodeId: string; // ユニークキー用
}

export function AnimatedIcon({ icon, size, color, muted, nodeId }: Props) {
  const animType = muted ? undefined : ANIM_TYPE[icon];
  const pathD = getIconPath(icon);

  if (!animType) {
    // 静的アイコン
    return (
      <svg
        width={size} height={size}
        viewBox="0 0 24 24"
        fill="none" stroke={color}
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        opacity={muted ? 0.4 : 1}
      >
        <path d={pathD} />
      </svg>
    );
  }

  switch (animType) {
    case 'sparkle':
      return <SparkleIcon size={size} color={color} pathD={pathD} nodeId={nodeId} />;
    case 'pulse':
      return <PulseIcon size={size} color={color} pathD={pathD} nodeId={nodeId} />;
    case 'spin':
      return <SpinIcon size={size} color={color} pathD={pathD} nodeId={nodeId} />;
    case 'bounce':
      return <BounceIcon size={size} color={color} pathD={pathD} nodeId={nodeId} />;
    case 'blink':
      return <BlinkIcon size={size} color={color} pathD={pathD} nodeId={nodeId} />;
  }
}

/** AI / LLM — アイコンがきらめく + 周囲に小さな星が出現 */
function SparkleIcon({ size, color, pathD, nodeId }: { size: number; color: string; pathD: string; nodeId: string }) {
  const half = size / 2;
  // 3つの小さなきらめき点
  const dots = [
    { cx: size * 0.15, cy: size * 0.15, delay: '0s' },
    { cx: size * 0.85, cy: size * 0.25, delay: '0.8s' },
    { cx: size * 0.75, cy: size * 0.85, delay: '1.6s' },
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} overflow="visible">
      {/* メインアイコン — 呼吸するようにスケール */}
      <g transform={`translate(${half}, ${half})`}>
        <g>
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1;1.08;1"
            dur="2.5s"
            repeatCount="indefinite"
          />
          <svg
            x={-half} y={-half}
            width={size} height={size}
            viewBox="0 0 24 24"
            fill="none" stroke={color}
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          >
            <path d={pathD} />
          </svg>
        </g>
      </g>

      {/* きらめき点 */}
      {dots.map((d, i) => (
        <circle key={`${nodeId}-dot-${i}`} cx={d.cx} cy={d.cy} r={1.5} fill={color}>
          <animate
            attributeName="opacity"
            values="0;1;0"
            dur="2.4s"
            begin={d.delay}
            repeatCount="indefinite"
          />
          <animate
            attributeName="r"
            values="0;2;0"
            dur="2.4s"
            begin={d.delay}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

/** 処理・計算 — リングがパルスする */
function PulseIcon({ size, color, pathD, nodeId }: { size: number; color: string; pathD: string; nodeId: string }) {
  const half = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} overflow="visible">
      {/* パルスリング */}
      <circle cx={half} cy={half} r={half * 0.7} fill="none" stroke={color} strokeWidth={1} opacity={0}>
        <animate attributeName="r" values={`${half * 0.5};${half * 1.1}`} dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* メインアイコン */}
      <svg
        width={size} height={size}
        viewBox="0 0 24 24"
        fill="none" stroke={color}
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      >
        <path d={pathD} />
      </svg>
    </svg>
  );
}

/** フロー制御 — ゆっくり回転 */
function SpinIcon({ size, color, pathD, nodeId }: { size: number; color: string; pathD: string; nodeId: string }) {
  const half = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${half}, ${half})`}>
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0;360"
            dur="8s"
            repeatCount="indefinite"
          />
          <svg
            x={-half} y={-half}
            width={size} height={size}
            viewBox="0 0 24 24"
            fill="none" stroke={color}
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          >
            <path d={pathD} />
          </svg>
        </g>
      </g>
    </svg>
  );
}

/** 人間動作 — 軽い上下バウンス */
function BounceIcon({ size, color, pathD, nodeId }: { size: number; color: string; pathD: string; nodeId: string }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} overflow="visible">
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 0,-2; 0,0"
          dur="2s"
          repeatCount="indefinite"
        />
        <svg
          width={size} height={size}
          viewBox="0 0 24 24"
          fill="none" stroke={color}
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        >
          <path d={pathD} />
        </svg>
      </g>
    </svg>
  );
}

/** ひらめき / 点滅 — opacity が変化 */
function BlinkIcon({ size, color, pathD, nodeId }: { size: number; color: string; pathD: string; nodeId: string }) {
  const half = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} overflow="visible">
      {/* 光の拡散 */}
      <circle cx={half} cy={half} r={half * 0.4} fill={color} opacity={0}>
        <animate attributeName="opacity" values="0;0.2;0" dur="3s" repeatCount="indefinite" />
        <animate attributeName="r" values={`${half * 0.3};${half * 0.9};${half * 0.3}`} dur="3s" repeatCount="indefinite" />
      </circle>

      {/* メインアイコン */}
      <svg
        width={size} height={size}
        viewBox="0 0 24 24"
        fill="none" stroke={color}
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      >
        <path d={pathD}>
          <animate
            attributeName="opacity"
            values="0.6;1;0.6"
            dur="3s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    </svg>
  );
}

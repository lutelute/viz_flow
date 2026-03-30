/**
 * フローの最後のノードに到達したときに「ポン」と光るパルス演出
 */
interface Props {
  x: number;
  y: number;
  color: string;
  delay: number;     // パルス開始タイミング（秒）
  cycleDur: number;  // サイクル全体（秒）
}

export function ArrivalPulse({ x, y, color, delay, cycleDur }: Props) {
  // パルスの持続時間
  const pulseDur = 0.8;
  // パルスが占めるサイクル内の割合
  const t = pulseDur / cycleDur;
  const m = t * 0.1;

  return (
    <g>
      {/* 拡散リング */}
      <circle cx={x} cy={y} r={8} fill="none" stroke={color} strokeWidth={2} opacity={0}>
        <animate
          attributeName="r"
          values="8;28;28"
          keyTimes={`0;${t};1`}
          dur={`${cycleDur}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values={`0;0.5;0;0`}
          keyTimes={`0;${m};${t};1`}
          dur={`${cycleDur}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-width"
          values="2;0.5;0.5"
          keyTimes={`0;${t};1`}
          dur={`${cycleDur}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
      </circle>

      {/* コアのフラッシュ */}
      <circle cx={x} cy={y} r={6} fill={color} opacity={0} filter="url(#glow)">
        <animate
          attributeName="opacity"
          values={`0;0.6;0;0`}
          keyTimes={`0;${m};${t};1`}
          dur={`${cycleDur}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
        <animate
          attributeName="r"
          values="6;14;14"
          keyTimes={`0;${t};1`}
          dur={`${cycleDur}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
}

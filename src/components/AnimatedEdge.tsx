import { useRef, useEffect, useState } from 'react';
import type { FlowEdge, ParticleState } from '../core/types';
import type { Theme } from '../core/themes';
import { getIconPath } from '../utils/icons';

interface Props {
  edge: FlowEdge;
  path: string;
  theme: Theme;
  speed: number;
}

/**
 * n8n風のエッジ + 光の玉アニメーション
 * - 矢印付きの直線パス
 * - パーティクルはノード間を移動、状態変化可能
 */
export function AnimatedEdge({ edge, path, theme, speed }: Props) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const particleCount = edge.particleCount ?? 1;
  const edgeColor = edge.color ?? theme.edgeColor;
  const duration = 2.5 / ((edge.speed ?? 1) * speed);
  const showArrow = edge.arrow !== false;
  const markerId = `arrow-${edge.id}`;
  const ps = edge.particleState;

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [path]);

  const particles = Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    offset: i / particleCount,
  }));

  return (
    <g>
      {/* 矢印マーカー */}
      {showArrow && (
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 8"
            refX="10"
            refY="4"
            markerWidth="8"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 4 L 0 8 Z" fill={edgeColor} />
          </marker>
        </defs>
      )}

      {/* エッジライン */}
      <path
        d={path}
        fill="none"
        stroke={edgeColor}
        strokeWidth={1.8}
        strokeDasharray={edge.dashed ? '6 4' : undefined}
        strokeLinecap="round"
        markerEnd={showArrow ? `url(#${markerId})` : undefined}
        opacity={0.6}
      />

      {/* パス長計測用 */}
      <path ref={pathRef} d={path} fill="none" stroke="transparent" strokeWidth={0} />

      {/* エッジラベル */}
      {edge.label && (
        <>
          <defs>
            <path id={`epath-${edge.id}`} d={path} />
          </defs>
          {pathLength > 0 && (
            <text
              dy={-8}
              fill={theme.subtextColor}
              fontSize={10}
              fontWeight={500}
              fontFamily="system-ui, sans-serif"
              textAnchor="middle"
            >
              <textPath href={`#epath-${edge.id}`} startOffset="50%">
                {edge.label}
              </textPath>
            </text>
          )}
        </>
      )}

      {/* パーティクル（光の玉） */}
      {pathLength > 0 &&
        particles.map((p) => (
          <g key={p.id}>
            {/* 状態を持つパーティクル */}
            {ps ? (
              <StatefulParticle
                state={ps}
                path={path}
                duration={duration}
                offset={p.offset}
                theme={theme}
              />
            ) : (
              <SimpleParticle
                path={path}
                duration={duration}
                offset={p.offset}
                color={edge.color ?? theme.particleColor}
              />
            )}
          </g>
        ))}
    </g>
  );
}

/** シンプルな光の玉 */
function SimpleParticle({
  path, duration, offset, color,
}: {
  path: string; duration: number; offset: number; color: string;
}) {
  return (
    <>
      {/* ソフトなグロー */}
      <circle r={10} fill={color} opacity={0} filter="url(#glow)">
        <animateMotion
          dur={`${duration}s`} repeatCount="indefinite"
          begin={`${offset * duration}s`} path={path}
        />
        <animate
          attributeName="opacity"
          values="0;0.12;0.12;0"
          keyTimes="0;0.08;0.92;1"
          dur={`${duration}s`} begin={`${offset * duration}s`}
          repeatCount="indefinite"
        />
      </circle>
      {/* コアの玉 */}
      <circle r={4} fill={color} opacity={0}>
        <animateMotion
          dur={`${duration}s`} repeatCount="indefinite"
          begin={`${offset * duration}s`} path={path}
        />
        <animate
          attributeName="opacity"
          values="0;0.9;0.9;0"
          keyTimes="0;0.08;0.92;1"
          dur={`${duration}s`} begin={`${offset * duration}s`}
          repeatCount="indefinite"
        />
      </circle>
    </>
  );
}

/** 状態を持つパーティクル — アイコン+ラベル付き */
function StatefulParticle({
  state, path, duration, offset, theme,
}: {
  state: ParticleState; path: string; duration: number; offset: number; theme: Theme;
}) {
  const sz = state.size ?? 24;
  const half = sz / 2;

  return (
    <g opacity={0}>
      <animateMotion
        dur={`${duration}s`} repeatCount="indefinite"
        begin={`${offset * duration}s`} path={path}
      />
      <animate
        attributeName="opacity"
        values="0;1;1;0"
        keyTimes="0;0.08;0.92;1"
        dur={`${duration}s`} begin={`${offset * duration}s`}
        repeatCount="indefinite"
      />

      {/* 背景の丸 */}
      <circle r={half + 4} fill={state.color} opacity={0.15} />
      <circle r={half} fill={state.color} opacity={0.9} />

      {/* アイコン */}
      {state.icon && (
        <g transform={`translate(${-half * 0.5}, ${-half * 0.5})`}>
          <svg
            width={half}
            height={half}
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={getIconPath(state.icon)} />
          </svg>
        </g>
      )}

      {/* ラベル */}
      {state.label && (
        <text
          y={half + 14}
          textAnchor="middle"
          fill={theme.textColor}
          fontSize={9}
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
        >
          {state.label}
        </text>
      )}
    </g>
  );
}

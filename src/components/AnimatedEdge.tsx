import { useRef, useEffect, useState } from 'react';
import type { FlowEdge, ParticleState } from '../core/types';
import type { Theme } from '../core/themes';
import { useAnimationEnabled } from '../core/a11y';
import { getIconPath } from '../utils/icons';

interface Props {
  edge: FlowEdge;
  path: string;
  theme: Theme;
  speed: number;
}

export function AnimatedEdge({ edge, path, theme, speed }: Props) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const edgeColor = edge.color ?? theme.edgeColor;
  const showArrow = edge.arrow !== false;
  const markerId = `arrow-${edge.id}`;
  const ps = edge.particleState;
  const animEnabled = useAnimationEnabled();

  const travelDur = 1.5 / ((edge.speed ?? 1) * speed);
  const cycleDur = 8 / speed;
  const delay = edge.delay ?? 0;
  // パス上の移動比率（サイクル全体に対する）
  const tr = travelDur / cycleDur;

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [path]);

  return (
    <g>
      {showArrow && (
        <defs>
          <marker
            id={markerId} viewBox="0 0 10 8"
            refX="10" refY="4" markerWidth="8" markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 4 L 0 8 Z" fill={edgeColor} />
          </marker>
        </defs>
      )}

      <path
        d={path} fill="none" stroke={edgeColor}
        strokeWidth={1.8}
        strokeDasharray={edge.dashed ? '6 4' : undefined}
        strokeLinecap="round"
        markerEnd={showArrow ? `url(#${markerId})` : undefined}
        opacity={0.5}
      />

      <path ref={pathRef} d={path} fill="none" stroke="transparent" strokeWidth={0} />

      {edge.label && (
        <>
          <defs><path id={`ep-${edge.id}`} d={path} /></defs>
          {pathLength > 0 && (
            <text dy={-8} fill={theme.subtextColor} fontSize={10} fontWeight={500}
              fontFamily="'Inter', system-ui, sans-serif" textAnchor="middle">
              <textPath href={`#ep-${edge.id}`} startOffset="50%">{edge.label}</textPath>
            </text>
          )}
        </>
      )}

      {/* アニメーション無効時はパーティクル非表示 */}
      {animEnabled && pathLength > 0 && (
        ps
          ? <StatefulParticle state={ps} path={path} tr={tr} cycleDur={cycleDur} delay={delay} theme={theme} />
          : <SimpleParticle path={path} tr={tr} cycleDur={cycleDur} delay={delay} color={edge.color ?? theme.particleColor} />
      )}
    </g>
  );
}

/**
 * animateMotion: dur=cycleDur, keyPoints で移動区間を制限
 * → パス上を tr 割合だけ移動し、残りは終点に留まる
 * animate (opacity): 移動中だけ visible、残りは invisible
 */
function SimpleParticle({ path, tr, cycleDur, delay, color }: {
  path: string; tr: number; cycleDur: number; delay: number; color: string;
}) {
  return (
    <>
      <circle r={8} fill={color} opacity={0} filter="url(#glow)">
        <animateMotion
          dur={`${cycleDur}s`} begin={`${delay}s`} repeatCount="indefinite"
          keyPoints="0;1;1" keyTimes={`0;${tr};1`} calcMode="linear" path={path}
        />
        <animate attributeName="opacity"
          values="0;0.18;0.18;0;0" keyTimes={`0;0.01;${tr - 0.01};${tr};1`}
          dur={`${cycleDur}s`} begin={`${delay}s`} repeatCount="indefinite"
        />
      </circle>
      <circle r={3.5} fill={color} opacity={0}>
        <animateMotion
          dur={`${cycleDur}s`} begin={`${delay}s`} repeatCount="indefinite"
          keyPoints="0;1;1" keyTimes={`0;${tr};1`} calcMode="linear" path={path}
        />
        <animate attributeName="opacity"
          values="0;0.9;0.9;0;0" keyTimes={`0;0.01;${tr - 0.01};${tr};1`}
          dur={`${cycleDur}s`} begin={`${delay}s`} repeatCount="indefinite"
        />
      </circle>
    </>
  );
}

function StatefulParticle({ state, path, tr, cycleDur, delay, theme }: {
  state: ParticleState; path: string; tr: number; cycleDur: number; delay: number; theme: Theme;
}) {
  const sz = state.size ?? 24;
  const half = sz / 2;

  return (
    <g opacity={0}>
      <animateMotion
        dur={`${cycleDur}s`} begin={`${delay}s`} repeatCount="indefinite"
        keyPoints="0;1;1" keyTimes={`0;${tr};1`} calcMode="linear" path={path}
      />
      <animate attributeName="opacity"
        values="0;1;1;0;0" keyTimes={`0;0.01;${tr - 0.01};${tr};1`}
        dur={`${cycleDur}s`} begin={`${delay}s`} repeatCount="indefinite"
      />
      <circle r={half + 4} fill={state.color} opacity={0.15} />
      <circle r={half} fill={state.color} opacity={0.9} />
      {state.icon && (
        <g transform={`translate(${-half * 0.5}, ${-half * 0.5})`}>
          <svg width={half} height={half} viewBox="0 0 24 24"
            fill="none" stroke="white" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round">
            <path d={getIconPath(state.icon)} />
          </svg>
        </g>
      )}
      {state.label && (
        <text y={half + 14} textAnchor="middle" fill={theme.textColor}
          fontSize={9} fontWeight={600} fontFamily="'Inter', system-ui, sans-serif">
          {state.label}
        </text>
      )}
    </g>
  );
}

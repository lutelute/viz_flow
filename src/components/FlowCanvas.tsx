import { useRef, useMemo } from 'react';
import type { FlowDefinition } from '../core/types';
import { themes } from '../core/themes';
import { computePath } from '../core/path';
import { FlowNodeComponent } from './FlowNode';
import { FlowZoneComponent } from './FlowZone';
import { AnimatedEdge } from './AnimatedEdge';
import { ArrivalPulse } from './ArrivalPulse';
import { ParticleEngine } from './ParticleEngine';
import './FlowCanvas.css';

interface Props {
  flow: FlowDefinition;
}

export function FlowCanvas({ flow }: Props) {
  const { nodes, edges, config } = flow;
  const theme = themes[config.theme ?? 'light'];
  const speed = config.animationSpeed ?? 1;
  const cycleDur = 8 / speed;
  const particleLayerRef = useRef<SVGGElement>(null);

  // JS パーティクルモード判定
  const useJsParticles = config.particleMode === 'js'
    || (flow.particleGroups != null && flow.particleGroups.length > 0);

  const nodeMap = useMemo(() => {
    const map = new Map<string, (typeof nodes)[0]>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const edgePaths = useMemo(() => {
    return edges
      .map((edge) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) return null;
        return { edge, path: computePath(from, to) };
      })
      .filter(Boolean) as { edge: (typeof edges)[0]; path: string }[];
  }, [edges, nodeMap]);

  // SVG方式: 最後のエッジの到着パルス
  const lastEdge = useMemo(() => {
    if (useJsParticles) return null;
    let maxDelay = -1;
    let last = edges[0];
    for (const e of edges) {
      if ((e.delay ?? 0) > maxDelay) {
        maxDelay = e.delay ?? 0;
        last = e;
      }
    }
    return last;
  }, [edges, useJsParticles]);

  const lastNode = lastEdge ? nodeMap.get(lastEdge.to) : null;
  const lastDelay = lastEdge
    ? (lastEdge.delay ?? 0) + 2 / ((lastEdge.speed ?? 1) * speed)
    : 0;

  return (
    <div
      className="flow-canvas"
      style={{
        width: config.width,
        height: config.height,
        background: config.backgroundColor ?? theme.background,
        backgroundImage: theme.backgroundGradient,
      }}
    >
      {config.title && (
        <div className="flow-title" style={{ color: theme.textColor }}>
          <h1>{config.title}</h1>
          {config.subtitle && (
            <p style={{ color: theme.subtextColor }}>{config.subtitle}</p>
          )}
        </div>
      )}

      <svg
        width={config.width}
        height={config.height}
        viewBox={`0 0 ${config.width} ${config.height}`}
        className="flow-svg"
      >
        <defs>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ゾーン（最背面） */}
        {flow.zones?.map((zone) => (
          <FlowZoneComponent key={zone.id} zone={zone} theme={theme} />
        ))}

        {/* エッジ: JS モードではパーティクルなし（線だけ） */}
        {edgePaths.map(({ edge, path }) => (
          useJsParticles
            ? <StaticEdge key={edge.id} edge={edge} path={path} theme={theme} />
            : <AnimatedEdge key={edge.id} edge={edge} path={path} theme={theme} speed={speed} />
        ))}

        {/* ノード */}
        {nodes.map((node, i) => (
          <FlowNodeComponent
            key={node.id}
            node={node}
            theme={theme}
            accentColor={
              node.color ?? theme.accentColors[i % theme.accentColors.length]
            }
            showLabel={config.showLabels !== false}
          />
        ))}

        {/* SVG方式: 到着パルス */}
        {!useJsParticles && lastNode && (
          <ArrivalPulse
            x={lastNode.x} y={lastNode.y}
            color={lastNode.color ?? theme.accentColors[0]}
            delay={lastDelay} cycleDur={cycleDur}
          />
        )}

        {/* JS パーティクル描画レイヤー */}
        <g ref={particleLayerRef} />
      </svg>

      {/* JS パーティクルエンジン */}
      {useJsParticles && flow.particleGroups && (
        <ParticleEngine
          groups={flow.particleGroups}
          nodeMap={nodeMap}
          layerRef={particleLayerRef}
          theme={theme}
          speed={speed}
        />
      )}
    </div>
  );
}

/** エッジの線だけ描画（JS パーティクルモード用） */
function StaticEdge({ edge, path, theme }: {
  edge: { id: string; color?: string; dashed?: boolean; arrow?: boolean; label?: string };
  path: string;
  theme: { edgeColor: string; subtextColor: string };
}) {
  const edgeColor = edge.color ?? theme.edgeColor;
  const showArrow = edge.arrow !== false;
  const markerId = `arrow-s-${edge.id}`;

  return (
    <g>
      {showArrow && (
        <defs>
          <marker id={markerId} viewBox="0 0 10 8" refX="10" refY="4"
            markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 4 L 0 8 Z" fill={edgeColor} />
          </marker>
        </defs>
      )}
      <path
        d={path} fill="none" stroke={edgeColor} strokeWidth={1.8}
        strokeDasharray={edge.dashed ? '6 4' : undefined}
        strokeLinecap="round"
        markerEnd={showArrow ? `url(#${markerId})` : undefined}
        opacity={0.5}
      />
      {edge.label && (
        <>
          <defs><path id={`esp-${edge.id}`} d={path} /></defs>
          <text dy={-8} fill={theme.subtextColor} fontSize={10} fontWeight={500}
            fontFamily="'Inter', system-ui, sans-serif" textAnchor="middle">
            <textPath href={`#esp-${edge.id}`} startOffset="50%">{edge.label}</textPath>
          </text>
        </>
      )}
    </g>
  );
}

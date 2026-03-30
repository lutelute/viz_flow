import { useMemo } from 'react';
import type { FlowDefinition } from '../core/types';
import { themes } from '../core/themes';
import { computePath } from '../core/path';
import { FlowNodeComponent } from './FlowNode';
import { FlowZoneComponent } from './FlowZone';
import { AnimatedEdge } from './AnimatedEdge';
import { ArrivalPulse } from './ArrivalPulse';
import './FlowCanvas.css';

interface Props {
  flow: FlowDefinition;
}

export function FlowCanvas({ flow }: Props) {
  const { nodes, edges, config } = flow;
  const theme = themes[config.theme ?? 'light'];
  const speed = config.animationSpeed ?? 1;
  const cycleDur = 8 / speed;

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

  // 最後のエッジ（delay最大）の到着先にパルス
  const lastEdge = useMemo(() => {
    let maxDelay = -1;
    let last = edges[0];
    for (const e of edges) {
      if ((e.delay ?? 0) > maxDelay) {
        maxDelay = e.delay ?? 0;
        last = e;
      }
    }
    return last;
  }, [edges]);

  const lastNode = nodeMap.get(lastEdge?.to ?? '');
  const lastDelay = (lastEdge?.delay ?? 0) + 2 / ((lastEdge?.speed ?? 1) * speed);

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

        {/* エッジ */}
        {edgePaths.map(({ edge, path }) => (
          <AnimatedEdge
            key={edge.id}
            edge={edge}
            path={path}
            theme={theme}
            speed={speed}
          />
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

        {/* 到着パルス（最後のノード） */}
        {lastNode && (
          <ArrivalPulse
            x={lastNode.x}
            y={lastNode.y}
            color={lastNode.color ?? theme.accentColors[0]}
            delay={lastDelay}
            cycleDur={cycleDur}
          />
        )}
      </svg>
    </div>
  );
}

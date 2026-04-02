import type { FlowNode, NodeShape } from '../core/types';
import type { Theme } from '../core/themes';
import { getIconPath } from '../utils/icons';
import { AnimatedIcon } from './AnimatedIcon';

interface Props {
  node: FlowNode;
  theme: Theme;
  accentColor: string;
  showLabel: boolean;
}

export function FlowNodeComponent({ node, theme, accentColor, showLabel }: Props) {
  const shape = node.shape ?? 'icon-only';
  const color = accentColor;
  const textOpacity = 1;

  if (shape === 'icon-only') {
    return <IconOnlyNode node={node} theme={theme} color={color} showLabel={showLabel} textOpacity={textOpacity} />;
  }

  return <BoxNode node={node} theme={theme} accentColor={color} showLabel={showLabel} shape={shape} textOpacity={textOpacity} />;
}

function IconOnlyNode({
  node, theme, color, showLabel, textOpacity,
}: {
  node: FlowNode; theme: Theme; color: string; showLabel: boolean; textOpacity: number;
}) {
  const r = (node.width ?? 32) / 2;
  const iconSize = r * 1.9;  // アイコンをさらに大きく
  const bgOpacity = 0.12;
  const innerOpacity = 0.2;
  const labelGap = r + 24;   // ラベルとアイコンの間隔を広く
  const descGap = labelGap + 14;

  return (
    <g>
      <circle cx={node.x} cy={node.y} r={r + 8} fill={color} opacity={bgOpacity} />
      <circle cx={node.x} cy={node.y} r={r + 2} fill={color} opacity={innerOpacity} />

      <g transform={`translate(${node.x - iconSize / 2}, ${node.y - iconSize / 2})`}>
        <AnimatedIcon
          icon={node.icon ?? 'check-circle'}
          size={iconSize}
          color={color}
          muted={node.muted}
          nodeId={node.id}
        />
      </g>

      {showLabel && (
        <text
          x={node.x} y={node.y + labelGap}
          textAnchor="middle"
          fill={theme.textColor}
          fontSize={11} fontWeight={600}
          fontFamily="'Inter', system-ui, -apple-system, sans-serif"
          opacity={textOpacity}
        >
          {node.label}
        </text>
      )}

      {showLabel && node.description && (
        <text
          x={node.x} y={node.y + descGap}
          textAnchor="middle"
          fill={theme.subtextColor}
          fontSize={9}
          fontFamily="'Inter', system-ui, -apple-system, sans-serif"
          opacity={textOpacity}
        >
          {node.description}
        </text>
      )}
    </g>
  );
}

function BoxNode({
  node, theme, accentColor, showLabel, shape, textOpacity,
}: {
  node: FlowNode; theme: Theme; accentColor: string; showLabel: boolean; shape: NodeShape; textOpacity: number;
}) {
  const w = node.width ?? 120;
  const h = node.height ?? 48;
  const iconSize = 18;
  const hasIcon = !!node.icon;
  const iconX = node.x - w / 2 + 12;
  const iconY = node.y - iconSize / 2;
  const textX = hasIcon ? node.x - w / 2 + 12 + iconSize + 6 : node.x;
  const textAnchor = hasIcon ? ('start' as const) : ('middle' as const);

  return (
    <g opacity={1}>
      {renderShape(shape, node.x, node.y, w, h, theme, accentColor)}

      {hasIcon && (
        <g transform={`translate(${iconX}, ${iconY})`}>
          <AnimatedIcon
            icon={node.icon!}
            size={iconSize}
            color={accentColor}
            muted={node.muted}
            nodeId={node.id}
          />
        </g>
      )}

      {showLabel && (
        <text
          x={textX} y={node.y + 1}
          textAnchor={textAnchor} dominantBaseline="central"
          fill={theme.textColor} fontSize={11} fontWeight={600}
          fontFamily="'Inter', system-ui, -apple-system, sans-serif"
          opacity={textOpacity}
        >
          {node.label}
        </text>
      )}

      {showLabel && node.description && (
        <text
          x={node.x} y={node.y + h / 2 + 16}
          textAnchor="middle" fill={theme.subtextColor}
          fontSize={9} fontFamily="'Inter', system-ui, -apple-system, sans-serif"
          opacity={textOpacity}
        >
          {node.description}
        </text>
      )}
    </g>
  );
}

function renderShape(
  shape: NodeShape, cx: number, cy: number, w: number, h: number,
  theme: Theme, accent: string,
) {
  const x = cx - w / 2;
  const y = cy - h / 2;

  switch (shape) {
    case 'rect':
      return <rect x={x} y={y} width={w} height={h}
        fill={theme.nodeBackground} stroke={theme.nodeBorder} strokeWidth={1} />;
    case 'rounded':
      return <rect x={x} y={y} width={w} height={h} rx={10} ry={10}
        fill={theme.nodeBackground} stroke={theme.nodeBorder} strokeWidth={1} />;
    case 'diamond':
      return <polygon
        points={`${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`}
        fill={theme.nodeBackground} stroke={theme.nodeBorder} strokeWidth={1} />;
    case 'cylinder': {
      const ry = 7;
      return (
        <g>
          <rect x={x} y={y + ry} width={w} height={h - ry * 2}
            fill={theme.nodeBackground} stroke={theme.nodeBorder} strokeWidth={1} />
          <ellipse cx={cx} cy={y + ry} rx={w / 2} ry={ry}
            fill={theme.nodeBackground} stroke={theme.nodeBorder} strokeWidth={1} />
          <ellipse cx={cx} cy={y + h - ry} rx={w / 2} ry={ry}
            fill={theme.nodeBackground} stroke={theme.nodeBorder} strokeWidth={1} />
          <rect x={x + 0.5} y={y + ry} width={w - 1} height={h - ry * 2}
            fill={theme.nodeBackground} stroke="none" />
          <line x1={x} y1={y + ry} x2={x} y2={y + h - ry} stroke={theme.nodeBorder} strokeWidth={1} />
          <line x1={x + w} y1={y + ry} x2={x + w} y2={y + h - ry} stroke={theme.nodeBorder} strokeWidth={1} />
        </g>
      );
    }
    case 'document': {
      const wave = 7;
      return <path
        d={`M ${x} ${y} h ${w} v ${h - wave} q ${-w / 4} ${wave * 2} ${-w / 2} 0 t ${-w / 2} 0 Z`}
        fill={theme.nodeBackground} stroke={theme.nodeBorder} strokeWidth={1} />;
    }
    case 'circle':
      return <ellipse cx={cx} cy={cy}
        rx={Math.max(w, h) / 2} ry={Math.max(w, h) / 2}
        fill={theme.nodeBackground} stroke={theme.nodeBorder} strokeWidth={1} />;
    default:
      return renderShape('rounded', cx, cy, w, h, theme, accent);
  }
}

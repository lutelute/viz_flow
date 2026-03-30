import type { FlowZone } from '../core/types';
import type { Theme } from '../core/themes';

interface Props {
  zone: FlowZone;
  theme: Theme;
}

export function FlowZoneComponent({ zone, theme }: Props) {
  const color = zone.color ?? theme.subtextColor;
  const pos = zone.labelPosition ?? 'top-left';

  let textX: number;
  let textAnchor: 'start' | 'middle' | 'end';

  switch (pos) {
    case 'top-center':
    case 'bottom-center':
      textX = zone.x + zone.width / 2;
      textAnchor = 'middle';
      break;
    case 'top-right':
      textX = zone.x + zone.width - 8;
      textAnchor = 'end';
      break;
    default: // top-left, bottom-left
      textX = zone.x + 10;
      textAnchor = 'start';
      break;
  }

  const textY = pos.startsWith('bottom')
    ? zone.y + zone.height + 14
    : zone.y - 6;

  return (
    <g>
      <rect
        x={zone.x}
        y={zone.y}
        width={zone.width}
        height={zone.height}
        rx={8}
        ry={8}
        fill={color}
        fillOpacity={0.04}
        stroke={color}
        strokeWidth={1.2}
        strokeOpacity={0.2}
        strokeDasharray={zone.dashed ? '6 4' : undefined}
      />

      {zone.label && (
        <text
          x={textX}
          y={textY}
          textAnchor={textAnchor}
          fill={color}
          fontSize={10}
          fontWeight={600}
          fontFamily="'Inter', system-ui, -apple-system, sans-serif"
          opacity={0.6}
          letterSpacing="0.04em"
        >
          {zone.label}
        </text>
      )}
    </g>
  );
}

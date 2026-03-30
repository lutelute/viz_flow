import type { FlowNode } from './types';

/**
 * n8n/Mermaid風のパス生成
 * 直線ベースでL字に曲がる。角だけ小さな丸み。
 */
export function computePath(from: FlowNode, to: FlowNode): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // ほぼ直線
  if (Math.abs(dx) < 8 || Math.abs(dy) < 8) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }

  const r = Math.min(14, Math.abs(dx) * 0.25, Math.abs(dy) * 0.25);
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);

  if (isHorizontal) {
    const midX = from.x + dx * 0.5;
    return [
      `M ${from.x} ${from.y}`,
      `L ${midX - r * sx} ${from.y}`,
      `Q ${midX} ${from.y} ${midX} ${from.y + r * sy}`,
      `L ${midX} ${to.y - r * sy}`,
      `Q ${midX} ${to.y} ${midX + r * sx} ${to.y}`,
      `L ${to.x} ${to.y}`,
    ].join(' ');
  } else {
    const midY = from.y + dy * 0.5;
    return [
      `M ${from.x} ${from.y}`,
      `L ${from.x} ${midY - r * sy}`,
      `Q ${from.x} ${midY} ${from.x + r * sx} ${midY}`,
      `L ${to.x - r * sx} ${midY}`,
      `Q ${to.x} ${midY} ${to.x} ${midY + r * sy}`,
      `L ${to.x} ${to.y}`,
    ].join(' ');
  }
}

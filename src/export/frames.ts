// 動画のフレーム割り。1 周 D 秒を fps で割り、最後は t = (N-1)/fps で止める。
// t = D のフレームは描かない。Instagram が自動でループするので継ぎ目が消える。

export function frameCount(duration: number, fps: number, loops: number): number {
  return Math.max(1, Math.round(duration * fps * loops));
}

export function frameTime(i: number, fps: number, duration: number): number {
  if (duration <= 0) return 0;
  const t = i / fps;
  const wrapped = t % duration;
  // 浮動小数の誤差で D にほぼ等しくなったら 0 に丸める
  return duration - wrapped < 1e-9 ? 0 : wrapped;
}

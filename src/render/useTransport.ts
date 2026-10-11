import { useEffect, useSyncExternalStore } from 'react';
import type { Transport, TransportState } from '../timeline/transport';

/**
 * rAF はここにしか無い。Transport.tick(dt) を呼ぶ以外のことはしない。
 * タブが隠れている間は止める。
 */
export function useTransport(transport: Transport): TransportState {
  const state = useSyncExternalStore(
    (cb) => transport.subscribe(cb),
    () => transport.getState(),
    () => transport.getState(),
  );

  useEffect(() => {
    if (state.mode !== 'play') return;
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      if (document.hidden) {
        last = 0;
        frame = requestAnimationFrame(loop);
        return;
      }
      if (last) transport.tick(Math.min(now - last, 100));
      last = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [transport, state.mode]);

  return state;
}

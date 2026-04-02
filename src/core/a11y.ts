/**
 * アクセシビリティ関連のReactコンテキスト & フック
 *
 * - prefers-reduced-motion の検知
 * - UIトグルによるアニメーション停止
 */
import { createContext, useContext, useSyncExternalStore } from 'react';

// ── reduced-motion メディアクエリの購読 ──

function subscribePrefersReducedMotion(cb: () => void) {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

function getPrefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** OS設定で reduced-motion が有効かどうか */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribePrefersReducedMotion,
    getPrefersReducedMotion,
    () => false, // SSR fallback
  );
}

// ── アニメーション有効/無効コンテキスト ──

export const AnimationEnabledContext = createContext<boolean>(true);

/** アニメーションが有効かどうか（OS設定 + UIトグルの両方を考慮済み） */
export function useAnimationEnabled(): boolean {
  return useContext(AnimationEnabledContext);
}

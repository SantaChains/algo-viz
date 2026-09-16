import { useSyncExternalStore } from 'react';
import { viz } from '../core/engine';

/** 可视化引擎订阅：Player 与 Viewer 共用 */
export function useVisualization() {
  return useSyncExternalStore(viz.subscribe, viz.getVersion);
}

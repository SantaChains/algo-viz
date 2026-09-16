import type { Command } from '../core/types';

export interface SortConfig {
  size: number;
  min: number;
  max: number;
  seed: number;
  distribution: 'random' | 'nearly' | 'reversed' | 'fewUnique';
}

export interface GraphConfig {
  nodes: number;
  density: number;
  seed: number;
  directed: boolean;
}

export interface StringConfig {
  textLen: number;
  patLen: number;
  seed: number;
}

export interface DpConfig {
  n: number;
  m: number;
  seed: number;
}

export interface GreedyConfig {
  count: number;
  seed: number;
}

export type DemoConfig = SortConfig | GraphConfig | StringConfig | DpConfig | GreedyConfig;

export type DemoKind = 'sort' | 'search' | 'graph' | 'string' | 'dp' | 'greedy';

export interface AlgorithmDemo {
  id: string;
  kind: DemoKind;
  title: string;
  description: string;
  complexity: string;
  /** 不变式与学习要点 */
  notes: string;
  /** 源码行号 -> 中文讲解，SourcePanel 在行旁罗列 */
  annotations?: Record<number, string>;
  /** 统计方法名 -> 中文标签（select: 比较 等） */
  statLabels?: Record<string, string>;
  /** dp 类 demo 的 n/m 参数语义标签 */
  configLabels?: { n?: string; m?: string };
  defaultConfig: DemoConfig;
  /** 录制可视化命令流 */
  commands: (cfg: DemoConfig) => Command[];
  /** 算法源码（vite ?raw 导入，用于学习面板） */
  source: string;
}

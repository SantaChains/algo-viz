import type { DpConfig, GraphConfig, GreedyConfig, SortConfig, StringConfig } from './types';
import { mulberry32 } from '../core/random';

const DISTRIBUTIONS = ['random', 'nearly', 'reversed', 'fewUnique'] as const;

function generateSortData(cfg: SortConfig): number[] {
  const rand = mulberry32(cfg.seed);
  const span = cfg.max - cfg.min + 1;
  const pick = () => cfg.min + Math.floor(rand() * span);

  let data: number[];
  switch (cfg.distribution) {
    case 'reversed':
      data = Array.from({ length: cfg.size }, (_, i) => cfg.max - Math.round((i * (span - 1)) / Math.max(cfg.size - 1, 1)));
      break;
    case 'fewUnique': {
      const buckets = [pick(), pick(), pick(), pick(), pick()];
      data = Array.from({ length: cfg.size }, () => buckets[Math.floor(rand() * buckets.length)]);
      break;
    }
    case 'nearly': {
      data = Array.from({ length: cfg.size }, (_, i) => cfg.min + Math.round((i * (span - 1)) / Math.max(cfg.size - 1, 1)));
      const swaps = Math.max(2, Math.round(Math.log2(cfg.size)));
      for (let s = 0; s < swaps; s++) {
        const i = Math.floor(rand() * (cfg.size - 1));
        [data[i], data[i + 1]] = [data[i + 1], data[i]];
      }
      break;
    }
    default:
      data = Array.from({ length: cfg.size }, pick);
  }
  return data;
}

function generateMatrix(cfg: GraphConfig): number[][] {
  const rand = mulberry32(cfg.seed);
  const n = cfg.nodes;
  const matrix = Array.from({ length: n }, () => Array<number>(n).fill(0));
  // 随机树骨架保证连通（0 为根），再按密度补边
  for (let v = 1; v < n; v++) {
    const u = Math.floor(rand() * v);
    matrix[u][v] = 1;
    if (!cfg.directed) matrix[v][u] = 1;
  }
  const extra = Math.round(n * cfg.density);
  for (let e = 0; e < extra; e++) {
    const u = Math.floor(rand() * n);
    const v = Math.floor(rand() * n);
    if (u !== v && !matrix[u][v]) {
      matrix[u][v] = 1;
      if (!cfg.directed) matrix[v][u] = 1;
    }
  }
  return matrix;
}

/** 与 GraphTracer._layoutCircle 一致的圆布局坐标：半径 140，节点 0 在正上方 */
function circleCoord(i: number, n: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [Math.cos(a) * 140, Math.sin(a) * 140];
}

/**
 * 加权图输入：结构复用 generateMatrix（同种子同结构），
 * 权重 = 1 + ⌊弦长/120⌋，由圆布局几何确定——保证 w(e) ≥ 弦长/120，
 * A* 的欧氏启发式 h = ⌈直线距离/120⌉ 因此可采纳（不高估真实代价）。
 */
function generateWeighted(cfg: GraphConfig): number[][] {
  const matrix = generateMatrix(cfg);
  const n = cfg.nodes;
  for (let u = 0; u < n; u++) {
    for (let v = u + 1; v < n; v++) {
      if (!matrix[u][v]) continue;
      const [x1, y1] = circleCoord(u, n);
      const [x2, y2] = circleCoord(v, n);
      const w = 1 + Math.floor(Math.hypot(x1 - x2, y1 - y2) / 120);
      matrix[u][v] = w;
      if (matrix[v][u]) matrix[v][u] = w;
    }
  }
  return matrix;
}

/** 小字母表（'ab'）随机文本 + 从文本截取的模式串，保证至少一次匹配 */
function generateStrings(cfg: StringConfig): { text: string; pattern: string } {
  const rand = mulberry32(cfg.seed);
  const pick = () => (rand() < 0.5 ? 'a' : 'b');
  const text = Array.from({ length: cfg.textLen }, pick).join('');
  const start = Math.floor(rand() * (cfg.textLen - cfg.patLen + 1));
  return { text, pattern: text.slice(start, start + cfg.patLen) };
}

/** LIS 输入：n 个 1..m 的随机值（m 也被编辑距离复用为小字母表长度） */
function generateValues(cfg: DpConfig): number[] {
  const rand = mulberry32(cfg.seed);
  return Array.from({ length: cfg.n }, () => 1 + Math.floor(rand() * cfg.m));
}

/** 编辑距离输入：'abc' 字母表上两段随机串，保证既有公共子结构又有差异 */
function generateWords(cfg: DpConfig): { a: string; b: string } {
  const rand = mulberry32(cfg.seed);
  const pick = () => 'abc'[Math.floor(rand() * 3)];
  return {
    a: Array.from({ length: cfg.n }, pick).join(''),
    b: Array.from({ length: cfg.m }, pick).join(''),
  };
}

/** 区间调度输入：start 随机，长度 1..5，天然重叠 */
function generateIntervals(cfg: GreedyConfig): { start: number; end: number }[] {
  const rand = mulberry32(cfg.seed);
  return Array.from({ length: cfg.count }, () => {
    const start = Math.floor(rand() * 18);
    return { start, end: start + 1 + Math.floor(rand() * 5) };
  });
}

export {
  DISTRIBUTIONS,
  circleCoord,
  generateSortData,
  generateMatrix,
  generateWeighted,
  generateStrings,
  generateValues,
  generateWords,
  generateIntervals,
};

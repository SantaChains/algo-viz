import { describe, expect, test } from "bun:test";
import {
  DISTRIBUTIONS,
  generateIntervals,
  generateMatrix,
  generateSortData,
  generateStrings,
  generateValues,
  generateWeighted,
  generateWords,
} from "../src/algorithms/generators";
import type {
  DpConfig,
  GraphConfig,
  GreedyConfig,
  SortConfig,
  StringConfig,
} from "../src/algorithms/types";

const sortCfg = (over: Partial<SortConfig> = {}): SortConfig => ({
  size: 16,
  min: 5,
  max: 99,
  seed: 42,
  distribution: "random",
  ...over,
});
const graphCfg = (over: Partial<GraphConfig> = {}): GraphConfig => ({
  nodes: 8,
  density: 0.5,
  seed: 42,
  directed: false,
  ...over,
});

/** 无向图连通性：从 0 号点 BFS 应触达全部节点（树骨架保证） */
function isConnected(m: number[][]): boolean {
  const n = m.length;
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length) {
    const u = stack.pop()!;
    for (let v = 0; v < n; v++) {
      if (m[u][v] && !seen.has(v)) {
        seen.add(v);
        stack.push(v);
      }
    }
  }
  return seen.size === n;
}

describe("generateSortData", () => {
  test("同种子同分布可复现", () => {
    expect(generateSortData(sortCfg())).toEqual(generateSortData(sortCfg()));
  });

  test("长度等于 size，值落在 [min,max]", () => {
    const data = generateSortData(sortCfg({ size: 24, min: 10, max: 20 }));
    expect(data).toHaveLength(24);
    for (const v of data) {
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  test("reversed 分布非升序", () => {
    const data = generateSortData(sortCfg({ distribution: "reversed" }));
    for (let i = 1; i < data.length; i++) expect(data[i]).toBeLessThanOrEqual(data[i - 1]);
  });

  test("四分布均可生成", () => {
    expect(DISTRIBUTIONS).toHaveLength(4);
    for (const distribution of DISTRIBUTIONS) {
      expect(generateSortData(sortCfg({ distribution }))).toHaveLength(16);
    }
  });
});

describe("generateMatrix / generateWeighted", () => {
  test("无向图邻接矩阵对称", () => {
    const m = generateMatrix(graphCfg({ directed: false }));
    for (let i = 0; i < m.length; i++) {
      for (let j = 0; j < m.length; j++) expect(m[i][j]).toBe(m[j][i]);
    }
  });

  test("树骨架保证连通", () => {
    expect(isConnected(generateMatrix(graphCfg({ nodes: 12 })))).toBe(true);
  });

  test("加权图保留结构且权重为正整数", () => {
    const base = generateMatrix(graphCfg());
    const w = generateWeighted(graphCfg());
    for (let i = 0; i < w.length; i++) {
      for (let j = 0; j < w.length; j++) {
        if (base[i][j]) expect(w[i][j]).toBeGreaterThanOrEqual(1);
        else expect(w[i][j]).toBe(0);
      }
    }
  });
});

describe("generateStrings / generateWords", () => {
  test("模式串必在文本中出现（保证有匹配可观察）", () => {
    const { text, pattern } = generateStrings({ textLen: 24, patLen: 5, seed: 42 });
    expect(text).toHaveLength(24);
    expect(pattern).toHaveLength(5);
    expect(text.includes(pattern)).toBe(true);
  });

  test("文本仅含 'ab' 字母表", () => {
    const { text } = generateStrings({ textLen: 30, patLen: 4, seed: 7 });
    expect(/^[ab]+$/.test(text)).toBe(true);
  });

  test("generateWords 长度分别为 n/m，仅含 'abc'", () => {
    const cfg: DpConfig = { n: 7, m: 6, seed: 42 };
    const { a, b } = generateWords(cfg);
    expect(a).toHaveLength(7);
    expect(b).toHaveLength(6);
    expect(/^[abc]+$/.test(a) && /^[abc]+$/.test(b)).toBe(true);
  });
});

describe("generateValues / generateIntervals", () => {
  test("LIS 值序列长度 n，值在 1..m", () => {
    const cfg: DpConfig = { n: 12, m: 9, seed: 42 };
    const v = generateValues(cfg);
    expect(v).toHaveLength(12);
    for (const x of v) {
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(9);
    }
  });

  test("区间 end 严格大于 start，数量等于 count", () => {
    const cfg: GreedyConfig = { count: 10, seed: 42 };
    const iv = generateIntervals(cfg);
    expect(iv).toHaveLength(10);
    for (const { start, end } of iv) expect(end).toBeGreaterThan(start);
  });
});

describe("全部生成器种子稳定性", () => {
  test("同种子重复调用输出一致", () => {
    const s: StringConfig = { textLen: 20, patLen: 4, seed: 99 };
    expect(generateStrings(s)).toEqual(generateStrings(s));
    expect(generateMatrix(graphCfg())).toEqual(generateMatrix(graphCfg()));
  });
});

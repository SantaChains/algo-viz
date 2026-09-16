import { describe, expect, test } from "bun:test";
import { GraphTracer } from "../src/core/tracers";

/** 直接驱动重放实现（_ 前缀方法），锁定 GraphTracer 状态语义 */
function makeGraph(matrix: number[][], directed = false, weighted = false) {
  const g = new GraphTracer("g", "图");
  g._directed(directed);
  g._weighted(weighted);
  g._set(matrix);
  return g;
}

const triangle = [
  [0, 1, 1],
  [1, 0, 1],
  [1, 1, 0],
];

describe("GraphTracer._set 建图", () => {
  test("节点数 = 矩阵阶数", () => {
    expect(makeGraph(triangle).nodes).toHaveLength(3);
  });

  test("无向图去重：三角形 3 条边", () => {
    expect(makeGraph(triangle, false).edges).toHaveLength(3);
  });

  test("有向图每条 arc 各算一条边：三角形 6 条", () => {
    expect(makeGraph(triangle, true).edges).toHaveLength(6);
  });

  test("加权图读取矩阵权值，非加权权重为 null", () => {
    const w = makeGraph(
      [
        [0, 5],
        [5, 0],
      ],
      false,
      true,
    );
    expect(w.edges[0].weight).toBe(5);
    const u = makeGraph([
      [0, 5],
      [5, 0],
    ]);
    expect(u.edges[0].weight).toBeNull();
  });

  test("圆布局：节点坐标落在半径 140 的圆上", () => {
    for (const n of makeGraph(triangle).nodes) {
      expect(Math.hypot(n.x, n.y)).toBeCloseTo(140, 5);
    }
  });
});

describe("GraphTracer visit/leave/select 计数", () => {
  test("visit 递增节点与边 visitedCount，leave 递减", () => {
    const g = makeGraph(triangle, false);
    g._visit(1, 0);
    expect(g.findNode(1)!.visitedCount).toBe(1);
    expect(g.findEdge(0, 1)!.visitedCount).toBe(1);
    g._leave(1, 0);
    expect(g.findNode(1)!.visitedCount).toBe(0);
    expect(g.findEdge(0, 1)!.visitedCount).toBe(0);
  });

  test("select/deselect 递增递减 selectedCount", () => {
    const g = makeGraph(triangle, false);
    g._select(2, 0);
    expect(g.findNode(2)!.selectedCount).toBe(1);
    g._deselect(2, 0);
    expect(g.findNode(2)!.selectedCount).toBe(0);
  });

  test("无向图 findEdge 双向命中同一条边", () => {
    const g = makeGraph(triangle, false);
    expect(g.findEdge(0, 1)).toBe(g.findEdge(1, 0));
  });

  test("有向图 findEdge 区分方向", () => {
    const g = makeGraph(triangle, true);
    expect(g.findEdge(0, 1)).not.toBe(g.findEdge(1, 0));
  });

  test("visit 无边（无 source）时仅节点计数，不报错", () => {
    const g = makeGraph([
      [0, 0],
      [0, 0],
    ]);
    g._visit(1);
    expect(g.findNode(1)!.visitedCount).toBe(1);
  });
});

describe("GraphTracer layoutTree", () => {
  test("树布局产出有限坐标，根在顶层", () => {
    const g = makeGraph([
      [0, 1, 1],
      [1, 0, 0],
      [1, 0, 0],
    ]);
    g._layoutTree(0, true);
    for (const n of g.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
    expect(g.findNode(0)!.y).toBeLessThanOrEqual(g.findNode(1)!.y);
  });
});

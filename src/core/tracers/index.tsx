import { pushCommand } from "../engine";
import type { Renderable } from "../types";
import { Array1DRenderer, Array2DRenderer, GraphRenderer, LogRenderer } from "../renderers";
import type { ReactNode } from "react";

/**
 * Tracer 基类。
 * 录制模式：算法代码调用的每个方法都被 push 为命令（key + method + args）。
 * 重放模式：引擎调用 exec(method, args)，按约定转发到下划线前缀的实现方法。
 * 渲染：render() 返回渲染器组件，读取重放后的可变状态。
 */
export abstract class Tracer implements Renderable {
  readonly key: string;
  readonly title: string;

  constructor(key: string, title?: string) {
    this.key = key;
    this.title = title ?? key;
    // 构造本身也是一条命令，重放时由引擎按类名实例化
    pushCommand(key, this.commandName(), [this.title]);
  }

  abstract commandName(): string;

  abstract render(): ReactNode;

  /** 转发到 _<method> 实现 */
  exec(method: string, args: unknown[]) {
    const impl = (this as unknown as Record<string, ((...args: unknown[]) => void) | undefined>)[
      `_${method}`
    ];
    impl?.apply(this, args);
  }
}

/** 数组元素：值 + 高亮标记 */
export interface ArrayElement {
  value: unknown;
  patched: boolean;
  selected: boolean;
}

export class Array1DTracer extends Tracer {
  commandName() {
    return "Array1DTracer";
  }

  data: ArrayElement[] = [];

  set(array: unknown[]) {
    pushCommand(this.key, "set", [array]);
    return this;
  }

  patch(x: number, v: unknown) {
    pushCommand(this.key, "patch", [x, v]);
    return this;
  }

  depatch(x: number) {
    pushCommand(this.key, "depatch", [x]);
    return this;
  }

  select(sx: number, ex = sx) {
    pushCommand(this.key, "select", [sx, ex]);
    return this;
  }

  deselect(sx: number, ex = sx) {
    pushCommand(this.key, "deselect", [sx, ex]);
    return this;
  }

  // ---- 重放实现 ----

  _set(array: unknown[]) {
    this.data = array.map((value) => ({ value, patched: false, selected: false }));
  }

  _patch(x: number, v: unknown) {
    if (!this.data[x]) this.data[x] = { value: null, patched: false, selected: false };
    this.data[x].value = v;
    this.data[x].patched = true;
  }

  _depatch(x: number) {
    if (this.data[x]) this.data[x].patched = false;
  }

  _select(sx: number, ex: number) {
    for (let i = sx; i <= ex; i++) if (this.data[i]) this.data[i].selected = true;
  }

  _deselect(sx: number, ex: number) {
    for (let i = sx; i <= ex; i++) if (this.data[i]) this.data[i].selected = false;
  }

  render() {
    return <Array1DRenderer key={this.key} title={this.title} data={this.data} />;
  }
}

export class LogTracer extends Tracer {
  commandName() {
    return "LogTracer";
  }

  log = "";

  set(log = "") {
    pushCommand(this.key, "set", [log]);
    return this;
  }

  print(message: unknown) {
    pushCommand(this.key, "print", [message]);
    return this;
  }

  println(message: unknown) {
    pushCommand(this.key, "println", [message]);
    return this;
  }

  // ---- 重放实现 ----

  _set(log: string) {
    this.log = log;
  }

  _print(message: string) {
    this.log += message;
  }

  _println(message: string) {
    this.log += `${message}\n`;
  }

  render() {
    return <LogRenderer key={this.key} title={this.title} log={this.log} />;
  }
}

// ---- 二维数组 tracer（dp 表格等） ----

export class Array2DTracer extends Tracer {
  commandName() {
    return "Array2DTracer";
  }

  data: ArrayElement[][] = [];

  /** 整表初始化；patch(x,y,v) 按行 x 列 y 定位 */
  set(array2d: unknown[][]) {
    pushCommand(this.key, "set", [array2d]);
    return this;
  }

  patch(x: number, y: number, v: unknown) {
    pushCommand(this.key, "patch", [x, y, v]);
    return this;
  }

  depatch(x: number, y: number) {
    pushCommand(this.key, "depatch", [x, y]);
    return this;
  }

  select(x: number, y: number) {
    pushCommand(this.key, "select", [x, y]);
    return this;
  }

  deselect(x: number, y: number) {
    pushCommand(this.key, "deselect", [x, y]);
    return this;
  }

  // ---- 重放实现 ----

  _set(array2d: unknown[][]) {
    this.data = array2d.map((row) =>
      row.map((value) => ({ value, patched: false, selected: false })),
    );
  }

  /** patch 定位：行/单元格不存在则创建——编辑距离等只 patch 不 set 的算法依赖此惰性建格 */
  private _cell(x: number, y: number): ArrayElement {
    this.data[x] ??= [];
    this.data[x][y] ??= { value: null, patched: false, selected: false };
    return this.data[x][y];
  }

  /** 只读定位：select/depatch 不创建格，避免未写入的格子提前撑开表格 */
  private _peek(x: number, y: number): ArrayElement | undefined {
    return this.data[x]?.[y];
  }

  _patch(x: number, y: number, v: unknown) {
    const cell = this._cell(x, y);
    cell.value = v;
    cell.patched = true;
  }

  _depatch(x: number, y: number) {
    const cell = this._peek(x, y);
    if (cell) cell.patched = false;
  }

  _select(x: number, y: number) {
    const cell = this._peek(x, y);
    if (cell) cell.selected = true;
  }

  _deselect(x: number, y: number) {
    const cell = this._peek(x, y);
    if (cell) cell.selected = false;
  }

  render() {
    return <Array2DRenderer key={this.key} title={this.title} data={this.data} />;
  }
}

// ---- 图 tracer ----

export interface GraphNode {
  id: number;
  weight: number | null;
  x: number;
  y: number;
  visitedCount: number;
  selectedCount: number;
}

export interface GraphEdge {
  source: number;
  target: number;
  weight: number | null;
  visitedCount: number;
  selectedCount: number;
}

export class GraphTracer extends Tracer {
  commandName() {
    return "GraphTracer";
  }

  nodes: GraphNode[] = [];
  edges: GraphEdge[] = [];
  isDirected = true;
  isWeighted = false;
  // O(1) 索引：重放时 _visit/_select 等每条命令都查节点/边，
  // 旧版 findNode/findEdge 线性扫描使整条命令流退化为 O(steps×E)
  private nodeIndex = new Map<number, GraphNode>();
  private edgeIndex = new Map<string, GraphEdge>();

  set(array2d: number[][]) {
    pushCommand(this.key, "set", [array2d]);
    return this;
  }

  directed(isDirected = true) {
    pushCommand(this.key, "directed", [isDirected]);
    return this;
  }

  weighted(isWeighted = true) {
    pushCommand(this.key, "weighted", [isWeighted]);
    return this;
  }

  layoutCircle() {
    pushCommand(this.key, "layoutCircle", []);
    return this;
  }

  layoutTree(root = 0, sorted = false) {
    pushCommand(this.key, "layoutTree", [root, sorted]);
    return this;
  }

  visit(target: number, source?: number) {
    pushCommand(this.key, "visit", [target, source]);
    return this;
  }

  leave(target: number, source?: number) {
    pushCommand(this.key, "leave", [target, source]);
    return this;
  }

  select(target: number, source?: number) {
    pushCommand(this.key, "select", [target, source]);
    return this;
  }

  deselect(target: number, source?: number) {
    pushCommand(this.key, "deselect", [target, source]);
    return this;
  }

  // ---- 重放实现 ----

  _set(array2d: number[][]) {
    this.nodes = [];
    this.edges = [];
    this.nodeIndex.clear();
    this.edgeIndex.clear();
    for (let i = 0; i < array2d.length; i++) {
      this._addNode(i);
      for (let j = 0; j < array2d.length; j++) {
        if (array2d[i][j]) this._addEdge(i, j, this.isWeighted ? array2d[i][j] : null);
      }
    }
    this._layoutCircle();
  }

  _directed(isDirected: boolean) {
    this.isDirected = isDirected;
    this.reindexEdges(); // 有向性决定边键规范化方式，切换后重建索引
  }

  _weighted(isWeighted: boolean) {
    this.isWeighted = isWeighted;
  }

  private _addNode(id: number) {
    if (this.nodeIndex.has(id)) return;
    const node: GraphNode = { id, weight: null, x: 0, y: 0, visitedCount: 0, selectedCount: 0 };
    this.nodes.push(node);
    this.nodeIndex.set(id, node);
  }

  private _addEdge(source: number, target: number, weight: number | null = null) {
    const k = this.edgeKey(source, target);
    if (this.edgeIndex.has(k)) return;
    const edge: GraphEdge = { source, target, weight, visitedCount: 0, selectedCount: 0 };
    this.edges.push(edge);
    this.edgeIndex.set(k, edge);
  }

  /** 有向键区分方向；无向键规范化端点，使 (u,v) 与 (v,u) 命中同一条边 */
  private edgeKey(source: number, target: number): string {
    return this.isDirected
      ? `${source}>${target}`
      : `${Math.min(source, target)}>${Math.max(source, target)}`;
  }

  private reindexEdges() {
    this.edgeIndex.clear();
    for (const e of this.edges) this.edgeIndex.set(this.edgeKey(e.source, e.target), e);
  }

  _layoutCircle() {
    const n = this.nodes.length;
    if (n === 0) return;
    const unitAngle = (2 * Math.PI) / n;
    let angle = -Math.PI / 2;
    for (const node of this.nodes) {
      node.x = Math.cos(angle) * 140;
      node.y = Math.sin(angle) * 140;
      angle += unitAngle;
    }
  }

  _layoutTree(root = 0, sorted = false) {
    if (this.nodes.length === 0) return;
    // 无向邻接表：树布局按无向骨架展开
    const adj = new Map<number, number[]>();
    for (const node of this.nodes) adj.set(node.id, []);
    for (const e of this.edges) {
      adj.get(e.source)?.push(e.target);
      adj.get(e.target)?.push(e.source);
    }
    // 从 root 建生成树：visited 防环（旧版只排除自身，在无向树上会 0↔1 无限递归栈溢出），
    // 子节点在认领时即标记，保证 children 互不相交；order 为父先于子的前序
    const children = new Map<number, number[]>();
    const depth = new Map<number, number>();
    const order: number[] = [];
    const visited = new Set<number>();
    let maxDepth = 0;
    const build = (id: number, d: number) => {
      visited.add(id);
      depth.set(id, d);
      if (d > maxDepth) maxDepth = d;
      order.push(id);
      let kids = (adj.get(id) ?? []).filter((c) => !visited.has(c));
      if (sorted) kids = kids.sort((a, b) => a - b);
      for (const c of kids) visited.add(c); // 先占位，兄弟分支不再重复认领
      children.set(id, kids);
      for (const c of kids) build(c, d + 1);
    };
    build(root, 0);
    // 自底向上回算每棵子树叶子数（逆前序 = 子先于父）
    const leaves = new Map<number, number>();
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i];
      const kids = children.get(id) ?? [];
      leaves.set(id, kids.length === 0 ? 1 : kids.reduce((sum, c) => sum + (leaves.get(c) ?? 0), 0));
    }
    const hGap = 280 / (leaves.get(root) || 1);
    const vGap = maxDepth === 0 ? 0 : 280 / maxDepth;
    // 第二次遍历定位：节点 x 取其子树占据的叶子区间中点，y 按深度分层
    const placeX = (id: number, start: number) => {
      const node = this.nodeIndex.get(id);
      if (node) {
        node.x = -140 + (start + (leaves.get(id) ?? 1) / 2) * hGap;
        node.y = -140 + (depth.get(id) ?? 0) * vGap;
      }
      let childStart = start;
      for (const c of children.get(id) ?? []) {
        placeX(c, childStart);
        childStart += leaves.get(c) ?? 0;
      }
    };
    placeX(root, 0);
  }

  findNode(id: number) {
    return this.nodeIndex.get(id);
  }

  findEdge(source: number | undefined, target: number) {
    if (source === undefined) return undefined;
    return this.edgeIndex.get(this.edgeKey(source, target));
  }

  _visit(target: number, source?: number) {
    const edge = this.findEdge(source, target);
    if (edge) edge.visitedCount++;
    const node = this.findNode(target);
    if (node) node.visitedCount++;
  }

  _leave(target: number, source?: number) {
    const edge = this.findEdge(source, target);
    if (edge) edge.visitedCount--;
    const node = this.findNode(target);
    if (node) node.visitedCount--;
  }

  _select(target: number, source?: number) {
    const edge = this.findEdge(source, target);
    if (edge) edge.selectedCount++;
    const node = this.findNode(target);
    if (node) node.selectedCount++;
  }

  _deselect(target: number, source?: number) {
    const edge = this.findEdge(source, target);
    if (edge) edge.selectedCount--;
    const node = this.findNode(target);
    if (node) node.selectedCount--;
  }

  render() {
    return (
      <GraphRenderer
        key={this.key}
        title={this.title}
        nodes={this.nodes}
        edges={this.edges}
        isDirected={this.isDirected}
      />
    );
  }
}

/** 重放与录制共用：构造命令 method -> 类（构造契约：(key, title?)） */
export const tracerClasses: Record<
  string,
  typeof Array1DTracer | typeof Array2DTracer | typeof GraphTracer | typeof LogTracer
> = {
  Array1DTracer,
  Array2DTracer,
  GraphTracer,
  LogTracer,
};

import { record, delay, setRoot } from '../core/engine';
import { Array1DTracer, GraphTracer, LogTracer } from '../core/tracers';
import { VerticalLayout } from '../core/layouts';
import { circleCoord, generateWeighted } from './generators';
import type { Command } from '../core/types';
import type { GraphConfig } from './types';

/**
 * A* 启发式搜索：与 Dijkstra 同框架，选点依据换成 f = g + h。
 * h = ⌈到目标的直线距离/120⌉；权重 = 1 + ⌊弦长/120⌋ 保证 h 可采纳（不高估），
 * 故目标定型即最短路，可提前终止。h = 0 时退化为 Dijkstra。
 */
export function graphAstarCommands(cfg: GraphConfig): Command[] {
  return record(() => {
    const matrix = generateWeighted(cfg);
    const n = matrix.length;
    const target = n - 1;
    const graph = new GraphTracer('graph', cfg.directed ? '有向带权图 G' : '无向带权图 G');
    const f = new Array1DTracer('f', 'f = g + h 估计');
    const log = new LogTracer('log', '搜索日志');
    new VerticalLayout('root', ['graph', 'f', 'log']);
    setRoot('root');

    graph.weighted(true).directed(cfg.directed).set(matrix);
    f.set(Array(n).fill('∞'));

    const [tx, ty] = circleCoord(target, n);
    const h = (v: number) => {
      const [x, y] = circleCoord(v, n);
      return Math.ceil(Math.hypot(x - tx, y - ty) / 120);
    };

    const INF = Infinity;
    const fmt = (x: number) => (x === INF ? '∞' : String(x));
    const g = Array<number>(n).fill(INF);
    const parent = Array<number>(n).fill(-1);
    const closed = Array<boolean>(n).fill(false);
    g[0] = 0;

    // 开放节点中取 f = g + h 最小者；启发式把扩展方向拉向目标
    const pickMin = () => {
      let u = -1;
      for (let v = 0; v < n; v++)
        if (!closed[v] && g[v] < INF && (u < 0 || g[v] + h(v) < g[u] + h(u))) u = v;
      return u;
    };

    for (let u = pickMin(); u >= 0 && u !== target; u = pickMin()) {
      closed[u] = true;
      if (parent[u] >= 0) graph.visit(u, parent[u]);
      else graph.visit(u);
      f.patch(u, g[u] + h(u));
      log.println(`${u} 定型：g = ${g[u]}，h = ${h(u)}，f = ${g[u] + h(u)}`);
      delay();
      f.depatch(u);

      for (let v = 0; v < n; v++) {
        if (!matrix[u][v] || closed[v]) continue;
        const ng = g[u] + matrix[u][v];
        graph.select(v, u);
        f.select(v);
        if (ng < g[v]) {
          g[v] = ng;
          parent[v] = u;
          f.patch(v, ng + h(v));
          log.println(`松弛 ${u} → ${v}：g = ${ng}，h = ${h(v)}，f = ${ng + h(v)}`);
        } else {
          log.println(`考察 ${u} → ${v}：g ${ng} ≥ ${fmt(g[v])}，不更新`);
        }
        delay();
        f.deselect(v);
        graph.deselect(v, u);
      }
    }

    // 目标出队即最优，沿 parent 回溯还原路径
    if (g[target] < INF) {
      closed[target] = true;
      if (parent[target] >= 0) graph.visit(target, parent[target]);
      else graph.visit(target);
      f.patch(target, g[target] + h(target));
      log.println(`目标 ${target} 定型：g = ${g[target]}，f = ${g[target] + h(target)}`);
      delay();
      const path: number[] = [];
      for (let v = target; v >= 0; v = parent[v]) path.unshift(v);
      log.println(`最短路: ${path.join(' → ')}（代价 ${g[target]}）`);
    }
  });
}

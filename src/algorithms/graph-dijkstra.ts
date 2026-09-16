import { record, delay, setRoot } from '../core/engine';
import { Array1DTracer, GraphTracer, LogTracer } from '../core/tracers';
import { VerticalLayout } from '../core/layouts';
import { generateWeighted } from './generators';
import type { Command } from '../core/types';
import type { GraphConfig } from './types';

/**
 * Dijkstra 最短路：每轮在未定节点中取 dist 最小者定型（visit，蓝），
 * 再松弛其出边（select，黄），dist 数组实时反映松弛进度。
 * 边权非负 ⇒ 定型即全局最优，visited 边汇成最短路树。
 */
export function graphDijkstraCommands(cfg: GraphConfig): Command[] {
  return record(() => {
    const matrix = generateWeighted(cfg);
    const n = matrix.length;
    const graph = new GraphTracer('graph', cfg.directed ? '有向带权图 G' : '无向带权图 G');
    const dist = new Array1DTracer('dist', 'dist 最短距离');
    const log = new LogTracer('log', '松弛日志');
    new VerticalLayout('root', ['graph', 'dist', 'log']);
    setRoot('root');

    graph.weighted(true).directed(cfg.directed).set(matrix);
    dist.set(Array(n).fill('∞'));

    const INF = Infinity;
    const fmt = (x: number) => (x === INF ? '∞' : String(x));
    const d = Array<number>(n).fill(INF);
    const parent = Array<number>(n).fill(-1);
    const done = Array<boolean>(n).fill(false);
    d[0] = 0;

    // 未定节点中取 dist 最小者；树骨架保证连通，每轮必有解
    const pickMin = () => {
      let u = -1;
      for (let v = 0; v < n; v++)
        if (!done[v] && d[v] < INF && (u < 0 || d[v] < d[u])) u = v;
      return u;
    };

    for (let u = pickMin(); u >= 0; u = pickMin()) {
      done[u] = true;
      if (parent[u] >= 0) graph.visit(u, parent[u]);
      else graph.visit(u);
      dist.patch(u, d[u]);
      log.println(`${u} 定型：dist = ${d[u]}`);
      delay();
      dist.depatch(u);

      for (let v = 0; v < n; v++) {
        if (!matrix[u][v] || done[v]) continue;
        const nd = d[u] + matrix[u][v];
        graph.select(v, u);
        dist.select(v);
        if (nd < d[v]) {
          const old = fmt(d[v]);
          d[v] = nd;
          parent[v] = u;
          dist.patch(v, nd);
          log.println(`松弛 ${u} → ${v}：dist[${v}] ${old} → ${nd}`);
        } else {
          log.println(`考察 ${u} → ${v}：${nd} ≥ dist[${v}] = ${fmt(d[v])}，不更新`);
        }
        delay();
        dist.deselect(v);
        graph.deselect(v, u);
      }
    }
    log.println('完成，最短距离: ' + d.map(fmt).join(' '));
  });
}

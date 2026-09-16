import { record, delay, setRoot } from '../core/engine';
import { GraphTracer, LogTracer } from '../core/tracers';
import { VerticalLayout } from '../core/layouts';
import { generateMatrix } from './generators';
import type { Command } from '../core/types';
import type { GraphConfig } from './types';

/**
 * 深度优先搜索：visit 记到达（蓝），select 记考察中（黄），leave 记回溯。
 * 图结构由种子生成：随机树骨架保证连通，再按密度补边。
 */
export function graphDfsCommands(cfg: GraphConfig): Command[] {
  return record(() => {
    const matrix = generateMatrix(cfg);
    const graph = new GraphTracer('graph', cfg.directed ? '有向图 G' : '无向图 G');
    const log = new LogTracer('log', '遍历日志');
    new VerticalLayout('root', ['graph', 'log']);
    setRoot('root');

    graph.directed(cfg.directed).set(matrix);

    const visited = new Set<number>();
    const neighbors = (u: number) =>
      matrix[u].map((w, v) => (w ? v : -1)).filter((v) => v >= 0);

    const dfs = (u: number, parent?: number) => {
      visited.add(u);
      graph.visit(u, parent);
      log.println(`${parent ?? 'start'} -> ${u}`);
      delay();
      for (const v of neighbors(u)) {
        if (!visited.has(v)) {
          graph.select(v, u);
          dfs(v, u);
          graph.deselect(v, u);
        }
      }
      graph.leave(u, parent);
      log.println(`${parent ?? '─'} <- ${u} (回溯)`);
      delay();
    };

    dfs(0);
    log.println('遍历完成: ' + [...visited].join(' -> '));
  });
}

import { record, delay, setRoot } from '../core/engine';
import { GraphTracer, LogTracer } from '../core/tracers';
import { VerticalLayout } from '../core/layouts';
import { generateMatrix } from './generators';
import type { Command } from '../core/types';
import type { GraphConfig } from './types';

/** 广度优先搜索：队列驱动，先访问距起点近的节点，visit 记入队，select 记发现的边。 */
export function graphBfsCommands(cfg: GraphConfig): Command[] {
  return record(() => {
    const matrix = generateMatrix(cfg);
    const graph = new GraphTracer('graph', cfg.directed ? '有向图 G' : '无向图 G');
    const log = new LogTracer('log', '遍历日志');
    new VerticalLayout('root', ['graph', 'log']);
    setRoot('root');

    graph.directed(cfg.directed).set(matrix);

    const visited = new Set<number>([0]);
    const queue: number[] = [0];
    graph.visit(0);
    log.println(`起点 0 入队 -> 队列 [0]`);
    delay();

    while (queue.length > 0) {
      const u = queue.shift()!;
      for (let v = 0; v < matrix.length; v++) {
        if (matrix[u][v] && !visited.has(v)) {
          graph.select(v, u);
          visited.add(v);
          graph.visit(v, u);
          queue.push(v);
          log.println(`由 ${u} 发现 ${v}，入队 -> 队列 [${queue.join(', ')}]`);
          delay();
          graph.deselect(v, u);
        }
      }
      log.println(`${u} 出队，距离层完成`);
      delay();
    }
    log.println('遍历完成: ' + [...visited].join(' -> '));
  });
}

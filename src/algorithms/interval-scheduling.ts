import { record, delay, setRoot } from '../core/engine';
import { Array1DTracer, LogTracer } from '../core/tracers';
import { VerticalLayout } from '../core/layouts';
import { generateIntervals } from './generators';
import type { Command } from '../core/types';
import type { GreedyConfig } from './types';

/**
 * 区间调度（活动选择）：按结束时间排序后线性扫描，
 * 贪心选择结束最早且与已选区间不冲突的活动。
 */
export function intervalSchedulingCommands(cfg: GreedyConfig): Command[] {
  return record(() => {
    const sorted = generateIntervals(cfg).sort((a, b) => a.end - b.end);
    const cells = sorted.map((iv) => `[${iv.start},${iv.end})`);
    const ivTracer = new Array1DTracer('iv', '区间（已按结束时间升序）');
    const logTracer = new LogTracer('log', '日志');
    new VerticalLayout('root', ['iv', 'log']);
    setRoot('root');

    ivTracer.set(cells);
    logTracer.println(`共 ${sorted.length} 个区间，策略：结束越早，留给后面的空间越大`);
    let lastEnd = 0;
    const chosen: string[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const iv = sorted[i];
      ivTracer.select(i);
      logTracer.println(`考察 [${iv.start},${iv.end})：start=${iv.start} ${iv.start >= lastEnd ? '不早于' : '早于'} 已占用的 ${lastEnd}`);
      delay();
      if (iv.start >= lastEnd) {
        lastEnd = iv.end;
        chosen.push(cells[i]);
        ivTracer.patch(i, cells[i]);
        logTracer.println(`选中，lastEnd 更新为 ${iv.end}`);
      } else {
        logTracer.println('与已选区间重叠，跳过');
      }
      delay();
      ivTracer.deselect(i);
    }
    logTracer.println(`最多互不冲突区间：${chosen.length} 个 → ${chosen.join(' ')}`);
  });
}

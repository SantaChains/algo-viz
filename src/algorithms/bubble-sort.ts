import { record, delay, setRoot } from '../core/engine';
import { Array1DTracer, LogTracer } from '../core/tracers';
import { VerticalLayout } from '../core/layouts';
import { generateSortData } from './generators';
import type { Command } from '../core/types';
import type { SortConfig } from './types';

/**
 * 冒泡排序：相邻比较、逆序交换，每轮冒出最大值。
 * tracer API 调用与算法语句交织，delay() 即一帧。
 */
export function bubbleSortCommands(cfg: SortConfig): Command[] {
  return record(() => {
    const data = generateSortData(cfg);
    const arrayTracer = new Array1DTracer('data', '数组');
    const logTracer = new LogTracer('log', '日志');
    new VerticalLayout('root', ['data', 'log']);
    setRoot('root');

    arrayTracer.set(data);
    logTracer.println(`初始: ${data.join(', ')}`);

    for (let i = 0; i < data.length - 1; i++) {
      let swapped = 0;
      for (let j = 0; j < data.length - 1 - i; j++) {
        arrayTracer.select(j, j + 1);
        delay();
        if (data[j] > data[j + 1]) {
          [data[j], data[j + 1]] = [data[j + 1], data[j]];
          arrayTracer.patch(j, data[j]).patch(j + 1, data[j + 1]);
          logTracer.println(`交换 a[${j}] 与 a[${j + 1}] -> ${data.join(', ')}`);
          delay();
          arrayTracer.depatch(j).depatch(j + 1);
          swapped++;
        }
        arrayTracer.deselect(j, j + 1);
      }
      logTracer.println(`第 ${i + 1} 轮: ${data.join(', ')}`);
      if (swapped === 0) break;
    }
    logTracer.println('排序完成');
  });
}

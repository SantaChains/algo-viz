import { record, delay, setRoot } from '../core/engine';
import { Array1DTracer, LogTracer } from '../core/tracers';
import { VerticalLayout } from '../core/layouts';
import { generateSortData } from './generators';
import type { Command } from '../core/types';
import type { SortConfig } from './types';

/** 快速排序（Lomuto 分区）：选末尾为主轴，小于主轴的换到左侧分区，主轴落位后分治两侧。 */
export function quickSortCommands(cfg: SortConfig): Command[] {
  return record(() => {
    const data = generateSortData(cfg);
    const arrayTracer = new Array1DTracer('data', '数组');
    const logTracer = new LogTracer('log', '日志');
    new VerticalLayout('root', ['data', 'log']);
    setRoot('root');

    arrayTracer.set(data);
    logTracer.println(`初始: ${data.join(', ')}`);

    const swap = (i: number, j: number) => {
      [data[i], data[j]] = [data[j], data[i]];
      arrayTracer.patch(i, data[i]).patch(j, data[j]);
      logTracer.println(`交换 a[${i}] 与 a[${j}] -> ${data.join(', ')}`);
      delay();
      arrayTracer.depatch(i).depatch(j);
    };

    const partition = (lo: number, hi: number) => {
      const pivot = data[hi];
      arrayTracer.select(hi);
      logTracer.println(`区间 [${lo}, ${hi}]，主轴 pivot = a[${hi}] = ${pivot}`);
      delay();
      arrayTracer.deselect(hi);
      let i = lo;
      for (let j = lo; j < hi; j++) {
        arrayTracer.select(j);
        delay();
        if (data[j] < pivot) {
          logTracer.println(`a[${j}] = ${data[j]} < ${pivot}，归入左区`);
          if (i !== j) swap(i, j);
          i++;
        } else {
          logTracer.println(`a[${j}] = ${data[j]} ≥ ${pivot}，留在右区`);
        }
        arrayTracer.deselect(j);
      }
      if (i !== hi) swap(i, hi);
      logTracer.println(`主轴落位 a[${i}] = ${data[i]}`);
      return i;
    };

    const quickSort = (lo: number, hi: number) => {
      if (lo >= hi) return;
      const p = partition(lo, hi);
      quickSort(lo, p - 1);
      quickSort(p + 1, hi);
    };

    quickSort(0, data.length - 1);
    logTracer.println('排序完成: ' + data.join(', '));
  });
}

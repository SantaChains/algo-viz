import { record, delay, setRoot } from '../core/engine';
import { Array1DTracer, LogTracer } from '../core/tracers';
import { VerticalLayout } from '../core/layouts';
import { generateSortData } from './generators';
import { mulberry32 } from '../core/random';
import type { Command } from '../core/types';
import type { SortConfig } from './types';

/** 二分查找：有序数组上取中点比较，每次排除一半区间，直到命中或区间为空。 */
export function binarySearchCommands(cfg: SortConfig): Command[] {
  return record(() => {
    const data = generateSortData(cfg).sort((a, b) => a - b);
    const target = data[Math.floor(mulberry32(cfg.seed)() * data.length)];
    const arrayTracer = new Array1DTracer('data', '有序数组');
    const logTracer = new LogTracer('log', '日志');
    new VerticalLayout('root', ['data', 'log']);
    setRoot('root');

    arrayTracer.set(data);
    logTracer.println(`有序: ${data.join(', ')}`);
    logTracer.println(`查找目标 target = ${target}`);

    let lo = 0;
    let hi = data.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      arrayTracer.select(lo, hi);
      logTracer.println(`区间 [${lo}, ${hi}]，取中点 mid = ${mid}，a[mid] = ${data[mid]}`);
      delay();
      if (data[mid] === target) {
        logTracer.println(`命中 a[${mid}] = ${target}`);
        found = mid;
        break;
      } else if (data[mid] < target) {
        arrayTracer.deselect(lo, hi);
        logTracer.println(`a[${mid}] < ${target}，目标在右半，lo = ${mid + 1}`);
        lo = mid + 1;
      } else {
        arrayTracer.deselect(lo, hi);
        logTracer.println(`a[${mid}] > ${target}，目标在左半，hi = ${mid - 1}`);
        hi = mid - 1;
      }
    }
    arrayTracer.select(found);
    logTracer.println(found >= 0 ? `查找成功，下标 ${found}` : '查找失败');
  });
}

import { record, delay, setRoot } from '../core/engine';
import { Array1DTracer, LogTracer } from '../core/tracers';
import { VerticalLayout } from '../core/layouts';
import { generateValues } from './generators';
import type { Command } from '../core/types';
import type { DpConfig } from './types';

/**
 * 最长上升子序列 LIS：O(n²) 递推。
 * dp[i] = 以 a[i] 结尾的最长上升子序列长度。
 */
export function lisCommands(cfg: DpConfig): Command[] {
  return record(() => {
    const a = generateValues(cfg);
    const dp = Array<number>(a.length).fill(1);
    const aTracer = new Array1DTracer('a', '序列 a');
    const dpTracer = new Array1DTracer('dp', 'dp[i]：以 a[i] 结尾的 LIS 长度');
    const logTracer = new LogTracer('log', '日志');
    new VerticalLayout('root', ['a', 'dp', 'log']);
    setRoot('root');

    aTracer.set(a);
    dpTracer.set(dp);
    logTracer.println('dp[i] = max(dp[j] + 1 | j < i 且 a[j] < a[i])，无则 1');
    let best = 1;

    for (let i = 0; i < a.length; i++) {
      dp[i] = 1;
      dpTracer.patch(i, 1);
      logTracer.println(`i=${i}：初始 dp[${i}]=1（只含自身）`);
      delay();
      for (let j = 0; j < i; j++) {
        aTracer.select(j);
        dpTracer.select(i);
        logTracer.println(`a[${j}]=${a[j]} < a[${i}]=${a[i]}？dp[${j}]+1=${dp[j] + 1} 与 dp[${i}]=${dp[i]} 比较`);
        delay();
        if (a[j] < a[i] && dp[j] + 1 > dp[i]) {
          dp[i] = dp[j] + 1;
          dpTracer.patch(i, dp[i]);
          logTracer.println(`成立：接在 j=${j} 之后，dp[${i}]=${dp[i]}`);
          delay();
        }
        aTracer.deselect(j);
        dpTracer.deselect(i);
      }
      best = Math.max(best, dp[i]);
      dpTracer.depatch(i);
    }
    logTracer.println(`LIS 长度 = ${best}`);
  });
}

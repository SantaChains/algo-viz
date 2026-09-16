import { record, delay, setRoot } from '../core/engine';
import { Array1DTracer, Array2DTracer, LogTracer } from '../core/tracers';
import { VerticalLayout, HorizontalLayout } from '../core/layouts';
import { generateWords } from './generators';
import type { Command } from '../core/types';
import type { DpConfig } from './types';

/**
 * 编辑距离：dp[i][j] = A 前 i 个字符变成 B 前 j 个字符的最少操作数。
 * 逐格填充，相等继承左上角，否则 1 + min(替换/删除/插入)。
 */
export function editDistanceCommands(cfg: DpConfig): Command[] {
  return record(() => {
    const { a, b } = generateWords(cfg);
    const n = a.length;
    const m = b.length;
    const dp = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
    const aTracer = new Array1DTracer('sa', `A = ${a}`);
    const bTracer = new Array1DTracer('sb', `B = ${b}`);
    const dpTracer = new Array2DTracer('dp', 'dp[i][j]：A 前 i 个 → B 前 j 个的最少操作数');
    const logTracer = new LogTracer('log', '日志');
    // 最优排版：A/B 串同行置于顶部，DP 表独占主区全高，日志固定右栏——
    // 四卡纵堆会把 DP 表压出滚动条，故主区与日志横向分栏
    new HorizontalLayout('ab', ['sa', 'sb']);
    new VerticalLayout('main', ['ab', 'dp']);
    new HorizontalLayout('root', ['main', 'log']);
    setRoot('root');

    aTracer.set(a.split(''));
    bTracer.set(b.split(''));

    for (let i = 0; i <= n; i++) {
      dp[i][0] = i;
      dpTracer.patch(i, 0, i);
    }
    for (let j = 0; j <= m; j++) {
      dp[0][j] = j;
      dpTracer.patch(0, j, j);
    }
    logTracer.println('边界：dp[i][0]=i（全删），dp[0][j]=j（全插）');
    delay();

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        dpTracer.select(i, j);
        aTracer.select(i - 1);
        bTracer.select(j - 1);
        logTracer.println(`A[${i - 1}]='${a[i - 1]}' 与 B[${j - 1}]='${b[j - 1]}' 比较`);
        delay();
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
          logTracer.println(`相等：继承左上角 dp[${i - 1}][${j - 1}]=${dp[i - 1][j - 1]}，本格无操作`);
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
          logTracer.println(`不等：1 + min(替换 ${dp[i - 1][j - 1]}, 删除 ${dp[i - 1][j]}, 插入 ${dp[i][j - 1]})`);
        }
        dpTracer.patch(i, j, dp[i][j]);
        delay();
        dpTracer.deselect(i, j);
        aTracer.deselect(i - 1);
        bTracer.deselect(j - 1);
      }
    }
    logTracer.println(`编辑距离 = ${dp[n][m]}`);
  });
}

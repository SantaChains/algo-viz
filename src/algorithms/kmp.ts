import { record, delay, setRoot } from '../core/engine';
import { Array1DTracer, LogTracer } from '../core/tracers';
import { VerticalLayout } from '../core/layouts';
import { generateStrings } from './generators';
import type { Command } from '../core/types';
import type { StringConfig } from './types';

/** KMP：先由模式串自匹配构建 fail 失配表，再扫描文本，失配时按 fail 回退，主指针永不回退。 */
export function kmpCommands(cfg: StringConfig): Command[] {
  return record(() => {
    const { text, pattern } = generateStrings(cfg);
    const t = [...text];
    const p = [...pattern];
    const n = t.length;
    const m = p.length;
    const fail = new Array<number>(m).fill(0);

    const textTracer = new Array1DTracer('text', `文本 (${text})`);
    const patTracer = new Array1DTracer('pattern', `模式串 (${pattern})`);
    const failTracer = new Array1DTracer('fail', 'fail 失配表');
    const log = new LogTracer('log', '日志');
    new VerticalLayout('root', ['text', 'pattern', 'fail', 'log']);
    setRoot('root');

    textTracer.set(t);
    patTracer.set(p);
    failTracer.set(fail);
    log.println('阶段一：构建 fail 表（模式串与自己比较）');

    let k = 0;
    for (let i = 1; i < m; i++) {
      while (k > 0 && p[i] !== p[k]) {
        patTracer.select(k, i);
        log.println(`p[${i}] ≠ p[${k}]，k = fail[${k - 1}] = ${fail[k - 1]}`);
        delay();
        patTracer.deselect(k, i);
        k = fail[k - 1];
      }
      patTracer.select(k, i);
      delay();
      if (p[i] === p[k]) {
        k++;
        fail[i] = k;
        failTracer.patch(i, k);
        log.println(`p[${i}] = p[${k - 1}]，fail[${i}] = ${k}`);
        delay();
        failTracer.depatch(i);
      }
      patTracer.deselect(k, i);
    }
    log.println(`fail 表构建完成: [${fail.join(', ')}]`);
    log.println('阶段二：扫描文本（i 只前进，失配时 j 按 fail 回退）');

    let j = 0;
    for (let i = 0; i < n; i++) {
      textTracer.select(i);
      patTracer.select(j);
      delay();
      while (j > 0 && t[i] !== p[j]) {
        patTracer.deselect(j);
        log.println(`t[${i}] ≠ p[${j}]，失配，j = fail[${j - 1}] = ${fail[j - 1]}`);
        j = fail[j - 1];
        patTracer.select(j);
        delay();
      }
      patTracer.deselect(j);
      textTracer.deselect(i);
      if (t[i] === p[j]) {
        j++;
      }
      if (j === m) {
        textTracer.select(i - m + 1, i);
        log.println(`匹配成功：位置 ${i - m + 1} .. ${i}`);
        delay();
        textTracer.deselect(i - m + 1, i);
        j = fail[j - 1];
      }
    }
    log.println('查找完成');
  });
}

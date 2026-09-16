import type { Plugin } from 'vite';
import MagicString from 'magic-string';

/**
 * delay-line 插件：构建期把算法源码中的裸 delay() 重写为 delay(行号)。
 * 引擎按 delay 参数记录 Chunk.lineNumber，SourcePanel 据此高亮当前执行行。
 * 扫描器跳过字符串与注释，手写代码零维护，行号永远与源文件一致。
 */
export function delayLine(): Plugin {
  return {
    name: 'algo-viz:delay-line',
    transform(code, id) {
      if (!/src[\\/]algorithms[\\/][^\\/]+\.ts$/.test(id) || id.includes('?raw')) return;
      const ms = new MagicString(code);
      let changed = false;
      let inBlock = false;
      let inString: string | null = null;
      let lineNo = 1;
      const n = code.length;
      let i = 0;

      while (i < n) {
        const two = code.slice(i, i + 2);
        const c = code[i];

        if (inString) {
          if (c === '\\') {
            i += 2;
          } else {
            if (c === inString) inString = null;
            if (c === '\n') lineNo++;
            i++;
          }
          continue;
        }
        if (inBlock) {
          if (two === '*/') {
            inBlock = false;
            i += 2;
          } else {
            if (c === '\n') lineNo++;
            i++;
          }
          continue;
        }
        if (two === '/*') {
          inBlock = true;
          i += 2;
          continue;
        }
        if (two === '//') {
          while (i < n && code[i] !== '\n') i++;
          continue;
        }
        if (c === '"' || c === "'" || c === '`') {
          inString = c;
          i++;
          continue;
        }
        if (c === '\n') {
          lineNo++;
          i++;
          continue;
        }
        if (two === 'de' && code.startsWith('delay(', i)) {
          const prev = i > 0 ? code[i - 1] : '';
          if (!/[A-Za-z0-9_$]/.test(prev)) {
            let j = i + 6;
            while (j < n && /\s/.test(code[j])) j++;
            if (code[j] === ')') {
              ms.appendLeft(j, String(lineNo));
              changed = true;
            }
          }
          i += 6;
          continue;
        }
        i++;
      }

      if (!changed) return;
      return { code: ms.toString(), map: ms.generateMap({ hires: true }) };
    },
  };
}

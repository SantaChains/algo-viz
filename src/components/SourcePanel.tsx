import { useEffect, useMemo, useRef } from 'react';
import { Box, Text } from '@mantine/core';
import { viz } from '../core/engine';
import { useVisualization } from '../hooks/useVisualization';
import { tokenizeLines } from './highlight';
import styles from './SourcePanel.module.scss';

interface Props {
  source: string;
  annotations?: Record<number, string>;
}

/** 最近的可滚动祖先（源码面板的 ScrollArea viewport）；找不到返回 null，绝不回退到 window */
function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** 源码学习面板：行号 + 代码 + 中文注释三列，当前执行行随播放高亮，点击行 seek 到该行步骤 */
export function SourcePanel({ source, annotations }: Props) {
  useVisualization();
  const lines = useMemo(() => tokenizeLines(source), [source]);
  const currentLine = viz.chunks[viz.cursor - 1]?.lineNumber ?? null;

  // 播放/步进时让当前执行行在「源码面板内部」滚到可见，绝不影响整页滚动：
  // 手动改最近可滚动祖先的 scrollTop（scrollIntoView 会连带滚动 window，窄屏下导致页面跳动）
  const currentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = currentRef.current;
    if (!el) return;
    const viewport = scrollParentOf(el);
    if (!viewport) return;
    const er = el.getBoundingClientRect();
    const vr = viewport.getBoundingClientRect();
    if (er.top < vr.top) viewport.scrollTop += er.top - vr.top;
    else if (er.bottom > vr.bottom) viewport.scrollTop += er.bottom - vr.bottom;
  }, [currentLine]);

  const seekToLine = (line: number) => {
    const index = viz.chunks.findIndex((chunk) => (chunk.lineNumber ?? Infinity) >= line);
    if (index >= 0) viz.seek(index + 1);
  };

  return (
    <Box className={styles.panel} component="div" role="table" aria-label="算法源码">
      {lines.map((tokens, i) => {
        const line = i + 1;
        const isCurrent = line === currentLine;
        const annotation = annotations?.[line];
        return (
          <Box
            key={line}
            ref={isCurrent ? currentRef : undefined}
            className={`${styles.row} ${isCurrent ? styles.current : ''} ${annotation ? styles.annotated : ''}`}
            onClick={() => seekToLine(line)}
          >
            <span className={styles.lineNo}>{line}</span>
            <code className={styles.code}>
              {tokens.length === 0
                ? '\u00A0'
                : tokens.map((token, k) =>
                    token.type === 'plain' ? (
                      token.text
                    ) : (
                      <span key={k} className={styles[token.type]}>{token.text}</span>
                    ),
                  )}
            </code>
            {annotation && (
              <Text className={styles.annotation} size="xs" c="dimmed" lh={1.5}>
                {annotation}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

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

/** 源码学习面板：行号 + 代码 + 中文注释三列，当前执行行随播放高亮，点击行 seek 到该行步骤 */
export function SourcePanel({ source, annotations }: Props) {
  useVisualization();
  const lines = useMemo(() => tokenizeLines(source), [source]);
  const currentLine = viz.chunks[viz.cursor - 1]?.lineNumber ?? null;

  // 播放/步进时把当前执行行滚入视野，长源码也不丢焦点（nearest：已在视野则不动）
  const currentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
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

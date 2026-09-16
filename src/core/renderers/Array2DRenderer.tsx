import { Fragment } from 'react';
import type { ArrayElement } from '../tracers';
import { RendererCard } from './RendererCard';
import { formatValue } from './format';
import styles from './Array2DRenderer.module.scss';

/** 二维数组渲染器：首行为列号、首列为行号，单元格状态与 Array1D 一致 */
export function Array2DRenderer({ title, data }: { title: string; data: ArrayElement[][] }) {
  const cols = Math.max(0, ...data.map((row) => row.length));

  return (
    <RendererCard title={title} className={styles.tableCard}>
      <div className={styles.scroll}>
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `28px repeat(${cols}, minmax(44px, 1fr))` }}
        >
          <div className={styles.head} />
          {Array.from({ length: cols }, (_, j) => (
            <div key={`h${j}`} className={styles.head}>{j}</div>
          ))}
          {data.map((row, i) => (
            <Fragment key={`r${i}`}>
              <div className={styles.head}>{i}</div>
              {Array.from({ length: cols }, (_, j) => {
                const cell = row[j];
                return (
                  <div
                    key={`${i}-${j}`}
                    className={[
                      styles.cell,
                      cell?.selected ? styles.selected : '',
                      cell?.patched ? styles.patched : '',
                    ].join(' ')}
                  >
                    {cell ? formatValue(cell.value) : ''}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </RendererCard>
  );
}

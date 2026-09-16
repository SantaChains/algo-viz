import type { ArrayElement } from '../tracers';
import { RendererCard } from './RendererCard';
import { formatValue } from './format';
import styles from './Array1DRenderer.module.scss';

export function Array1DRenderer({ title, data }: { title: string; data: ArrayElement[] }) {
  return (
    <RendererCard title={title}>
      <div className={styles.row}>
        {data.map((element, i) => (
          <div
            key={i}
            className={[
              styles.cell,
              element.selected ? styles.selected : '',
              element.patched ? styles.patched : '',
            ].join(' ')}
          >
            <span className={styles.index}>{i}</span>
            <span className={styles.value}>{formatValue(element.value)}</span>
          </div>
        ))}
      </div>
    </RendererCard>
  );
}

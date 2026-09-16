import { useEffect, useRef } from 'react';
import { RendererCard } from './RendererCard';
import styles from './LogRenderer.module.scss';

/** 终端式跟随：滚轮上翻解锁（阅读历史不被打断），下滚或新输出重新贴底 */
export function LogRenderer({ title, log }: { title: string; log: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [log]);

  const handleWheel = (e: React.WheelEvent) => {
    pinned.current = e.deltaY > 0;
  };

  return (
    <RendererCard title={title} className={styles.logCard}>
      <pre ref={ref} onWheel={handleWheel} className={styles.log}>
        {log}
      </pre>
    </RendererCard>
  );
}

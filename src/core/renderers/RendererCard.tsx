import type { ReactNode } from 'react';
import styles from './RendererCard.module.scss';

/** 渲染器统一外壳：标题 + 内容区，对应原版 Renderer 基类；className 供特定渲染器追加布局语义 */
export function RendererCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={className ? `${styles.card} ${className}` : styles.card}>
      <div className={styles.title}>{title}</div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

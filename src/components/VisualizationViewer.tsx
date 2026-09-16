import { Text } from '@mantine/core';
import { viz } from '../core/engine';
import { useVisualization } from '../hooks/useVisualization';
import styles from './VisualizationViewer.module.scss';

/** 可视化视图：订阅引擎，将当前布局根渲染出来，对应原版 VisualizationViewer */
export function VisualizationViewer() {
  useVisualization();

  if (!viz.root) {
    return (
      <div className={styles.viewer}>
        <Text c="dimmed" size="sm" ta="center">
          选择左侧算法分类开始可视化
        </Text>
      </div>
    );
  }

  return <div className={styles.viewer}>{viz.root.render(viz.getObject)}</div>;
}

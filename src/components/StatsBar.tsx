import { Badge, Group } from '@mantine/core';
import { viz } from '../core/engine';
import { useVisualization } from '../hooks/useVisualization';

const STAT_COLORS: Record<string, string> = {
  select: 'yellow',
  patch: 'grape',
  visit: 'blue',
  leave: 'teal',
};

/** 命令流统计条：步数 + 关键操作计数，标签由 demo 的 statLabels 提供中文名 */
export function StatsBar({ labels }: { labels?: Record<string, string> }) {
  useVisualization();
  const { steps, ops, byMethod } = viz.stats;
  if (steps === 0) return null;

  return (
    <Group gap="xs" wrap="wrap">
      <Badge variant="light" color="indigo">
        步数 {steps}
      </Badge>
      {Object.entries(byMethod).map(([method, count]) => (
        <Badge key={method} variant="light" color={STAT_COLORS[method] ?? 'gray'}>
          {labels?.[method] ?? method} {count}
        </Badge>
      ))}
      <Badge variant="light" color="gray">
        操作 {ops}
      </Badge>
    </Group>
  );
}

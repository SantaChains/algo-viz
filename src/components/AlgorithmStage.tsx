import { useEffect } from 'react';
import {
  Badge,
  Box,
  Grid,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { viz } from '../core/engine';
import type { AlgorithmDemo, DemoConfig } from '../algorithms';
import { Player } from './Player';
import { SourcePanel } from './SourcePanel';
import { StatsBar } from './StatsBar';
import { VisualizationViewer } from './VisualizationViewer';
import styles from './AlgorithmStage.module.scss';

interface Props {
  demo: AlgorithmDemo;
  cfg: DemoConfig;
  siblings: AlgorithmDemo[];
  onSelect: (id: string) => void;
}

/** 单分类演示页：可视化 + 统计 + 播放器在左，源码学习面板粘性在右，行号随播放高亮 */
export function AlgorithmStage({ demo, cfg, siblings, onSelect }: Props) {
  useEffect(() => {
    viz.run(demo.commands(cfg));
  }, [demo, cfg]);

  return (
    <Stack gap="md" maw={1280} flex={1} className={styles.stage}>
      <Box>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Title order={2}>{demo.title}</Title>
          <Badge variant="light" color="violet" visibleFrom="xs">
            {demo.complexity}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">{demo.description}</Text>
      </Box>

      {siblings.length > 1 && (
        <SegmentedControl
          value={demo.id}
          onChange={onSelect}
          data={siblings.map((d) => ({ value: d.id, label: d.title }))}
          aria-label="切换算法"
        />
      )}

      <Grid gap="md" className={styles.stageGrid}>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap="md" h="100%" className={styles.leftCol}>
            <VisualizationViewer />
            <div className={styles.fixed}>
              <StatsBar labels={demo.statLabels} />
            </div>
            <div className={styles.fixed}>
              <Player />
            </div>
            <Paper withBorder radius="md" p="md" className={styles.notes}>
              <Text size="xs" c="dimmed" tt="uppercase" mb={8}>
                认知锚点 · 不变式
              </Text>
              <Text size="sm" lh={1.7}>{demo.notes}</Text>
            </Paper>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Paper withBorder radius="md" p="md" className={styles.codePanel}>
            <Text size="xs" c="dimmed" tt="uppercase" mb={8}>
              算法源码 · 高亮为当前执行行 · 点击行可跳转
            </Text>
            <ScrollArea className={styles.codeScroll} type="auto" offsetScrollbars>
              <SourcePanel source={demo.source} annotations={demo.annotations} />
            </ScrollArea>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

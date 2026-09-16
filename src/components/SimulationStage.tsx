import { Badge, Box, Group, Paper, SegmentedControl, Stack, Text, Title, useComputedColorScheme } from '@mantine/core';
import { simRegistry, type SimDemo } from '../sims';

interface Props {
  demo: SimDemo;
  siblings: SimDemo[];
  onSelect: (id: string) => void;
}

/** 模拟专题舞台：画布 + 控制参数，无播放器/源码面板 */
export function SimulationStage({ demo, siblings, onSelect }: Props) {
  const scheme = useComputedColorScheme('light');
  const Sim = simRegistry[demo.id];

  return (
    <Stack gap="md" maw={1280} flex={1} style={{ minHeight: 0 }}>
      <Box>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Title order={2}>{demo.title}</Title>
          <Badge variant="light" color="teal" visibleFrom="xs">实时模拟</Badge>
        </Group>
        <Text size="sm" c="dimmed">{demo.description}</Text>
      </Box>

      {siblings.length > 1 && (
        <SegmentedControl
          value={demo.id}
          onChange={onSelect}
          data={siblings.map((d) => ({ value: d.id, label: d.title }))}
          aria-label="切换模拟"
        />
      )}

      <Paper
        withBorder
        radius="md"
        p="md"
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <Sim scheme={scheme} />
      </Paper>
    </Stack>
  );
}
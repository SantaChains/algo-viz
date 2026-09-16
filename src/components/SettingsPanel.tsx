import {
  ActionIcon,
  Divider,
  Group,
  NumberInput,
  RangeSlider,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconDice5 } from '@tabler/icons-react';
import { randomSeed } from '../core/random';
import type {
  AlgorithmDemo,
  DemoConfig,
  DpConfig,
  GraphConfig,
  GreedyConfig,
  SortConfig,
  StringConfig,
} from '../algorithms';

const DISTRIBUTION_OPTIONS = [
  { value: 'random', label: '随机' },
  { value: 'nearly', label: '近乎有序' },
  { value: 'reversed', label: '逆序' },
  { value: 'fewUnique', label: '少重复' },
];

interface Props {
  demo: AlgorithmDemo;
  cfg: DemoConfig;
  onChange: (cfg: DemoConfig) => void;
}

/** 设置侧栏：按 demo 类型渲染参数控件，改动即时重录命令流 */
export function SettingsPanel({ demo, cfg, onChange }: Props) {
  const setSeed = () => onChange({ ...cfg, seed: randomSeed() } as DemoConfig);

  return (
    <Stack gap="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        输入参数
      </Text>

      {(demo.kind === 'sort' || demo.kind === 'search') && (
        <SortSettings cfg={cfg as SortConfig} onChange={onChange} showDistribution={demo.kind === 'sort'} />
      )}
      {demo.kind === 'graph' && (
        <GraphSettings cfg={cfg as GraphConfig} onChange={onChange} />
      )}
      {demo.kind === 'string' && (
        <StringSettings cfg={cfg as StringConfig} onChange={onChange} />
      )}
      {demo.kind === 'dp' && (
        <DpSettings cfg={cfg as DpConfig} onChange={onChange} labels={demo.configLabels} />
      )}
      {demo.kind === 'greedy' && (
        <GreedySettings cfg={cfg as GreedyConfig} onChange={onChange} />
      )}

      <Divider />

      <Stack gap={6}>
        <Text size="sm" fw={500}>随机种子</Text>
        <Group gap="xs" wrap="nowrap">
          <NumberInput
            flex={1}
            value={cfg.seed}
            min={0}
            max={0xffffffff}
            onChange={(v) => onChange({ ...cfg, seed: Number(v) || 0 } as DemoConfig)}
          />
          <Tooltip label="换一批数据">
            <ActionIcon variant="default" size="input-sm" onClick={setSeed} aria-label="换一批数据">
              <IconDice5 size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Text size="xs" c="dimmed">
          同一种子生成同一份输入，任何设置都可精确复现。
        </Text>
      </Stack>
    </Stack>
  );
}

function SortSettings({
  cfg,
  onChange,
  showDistribution = true,
}: {
  cfg: SortConfig;
  onChange: (cfg: DemoConfig) => void;
  showDistribution?: boolean;
}) {
  return (
    <Stack gap="md">
      {showDistribution && (
        <Stack gap={6}>
          <Text size="sm" fw={500}>数据分布</Text>
          <SegmentedControl
            fullWidth
            data={DISTRIBUTION_OPTIONS}
            value={cfg.distribution}
            onChange={(v) => onChange({ ...cfg, distribution: v as SortConfig['distribution'] })}
          />
        </Stack>
      )}
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500}>规模</Text>
          <Text size="sm" c="dimmed">{cfg.size}</Text>
        </Group>
        <Slider min={8} max={40} step={1} value={cfg.size} onChange={(v) => onChange({ ...cfg, size: v })} />
      </Stack>
      {showDistribution && (
        <Stack gap={4}>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" fw={500}>值域</Text>
            <Text size="sm" c="dimmed">{cfg.min} ~ {cfg.max}</Text>
          </Group>
          <RangeSlider min={0} max={99} value={[cfg.min, cfg.max]} onChange={([min, max]) => onChange({ ...cfg, min, max })} />
        </Stack>
      )}
    </Stack>
  );
}

function GraphSettings({ cfg, onChange }: { cfg: GraphConfig; onChange: (cfg: DemoConfig) => void }) {
  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={500}>有向图</Text>
        <Switch checked={cfg.directed} onChange={(e) => onChange({ ...cfg, directed: e.currentTarget.checked })} />
      </Group>
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500}>节点数</Text>
          <Text size="sm" c="dimmed">{cfg.nodes}</Text>
        </Group>
        <Slider min={4} max={14} step={1} value={cfg.nodes} onChange={(v) => onChange({ ...cfg, nodes: v })} />
      </Stack>
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500}>边的密度</Text>
          <Text size="sm" c="dimmed">+{Math.round(cfg.nodes * cfg.density)} 条</Text>
        </Group>
        <Slider min={0} max={2} step={0.1} value={cfg.density} onChange={(v) => onChange({ ...cfg, density: v })} />
      </Stack>
    </Stack>
  );
}

function StringSettings({ cfg, onChange }: { cfg: StringConfig; onChange: (cfg: DemoConfig) => void }) {
  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500}>文本长度</Text>
          <Text size="sm" c="dimmed">{cfg.textLen}</Text>
        </Group>
        <Slider min={12} max={32} step={1} value={cfg.textLen} onChange={(v) => onChange({ ...cfg, textLen: v })} />
      </Stack>
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500}>模式串长度</Text>
          <Text size="sm" c="dimmed">{cfg.patLen}</Text>
        </Group>
        <Slider min={3} max={8} step={1} value={cfg.patLen} onChange={(v) => onChange({ ...cfg, patLen: v })} />
      </Stack>
    </Stack>
  );
}

function DpSettings({
  cfg,
  onChange,
  labels,
}: {
  cfg: DpConfig;
  onChange: (cfg: DemoConfig) => void;
  labels?: { n?: string; m?: string };
}) {
  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500}>{labels?.n ?? '规模 n'}</Text>
          <Text size="sm" c="dimmed">{cfg.n}</Text>
        </Group>
        <Slider min={4} max={14} step={1} value={cfg.n} onChange={(v) => onChange({ ...cfg, n: v })} />
      </Stack>
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500}>{labels?.m ?? '规模 m'}</Text>
          <Text size="sm" c="dimmed">{cfg.m}</Text>
        </Group>
        <Slider min={3} max={10} step={1} value={cfg.m} onChange={(v) => onChange({ ...cfg, m: v })} />
      </Stack>
    </Stack>
  );
}

function GreedySettings({ cfg, onChange }: { cfg: GreedyConfig; onChange: (cfg: DemoConfig) => void }) {
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={500}>区间数量</Text>
        <Text size="sm" c="dimmed">{cfg.count}</Text>
      </Group>
      <Slider min={6} max={14} step={1} value={cfg.count} onChange={(v) => onChange({ ...cfg, count: v })} />
    </Stack>
  );
}

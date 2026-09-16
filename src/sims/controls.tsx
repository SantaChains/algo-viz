import { ActionIcon, Group, Slider, Stack, Text, Tooltip } from '@mantine/core';
import { IconDice5, IconPlayerPause, IconPlayerPlay, IconRestore } from '@tabler/icons-react';
import { useSyncExternalStore } from 'react';
import { getStatVersion, statGet, subscribeStats } from './shared';
import s from './shared.module.scss';

// ---- 控制条通用控件 ----

export function PlayButton({ running, onToggle }: { running: boolean; onToggle: () => void }) {
  return (
    <Tooltip label={running ? '暂停' : '播放'}>
      <ActionIcon
        variant={running ? 'light' : 'filled'}
        color="violet"
        onClick={onToggle}
        aria-label={running ? '暂停' : '播放'}
      >
        {running ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function ResetButton({ onClick, label = '重新生成' }: { onClick: () => void; label?: string }) {
  return (
    <Tooltip label={label}>
      <ActionIcon variant="default" onClick={onClick} aria-label={label}>
        <IconRestore size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

export function DiceButton({ onClick, label = '换一批' }: { onClick: () => void; label?: string }) {
  return (
    <Tooltip label={label}>
      <ActionIcon variant="default" onClick={onClick} aria-label={label}>
        <IconDice5 size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

export function ParamSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <Stack gap={2} className={s.param}>
      <Group justify="space-between" wrap="nowrap" gap={4}>
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{label}</Text>
        <Text size="xs" c="dimmed">{format ? format(value) : value}</Text>
      </Group>
      <Slider
        size="xs"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        aria-label={label}
      />
    </Stack>
  );
}

export interface StatItem {
  key: string;
  label: string;
  format?: (v: number) => string;
}

/** 统计条：订阅模块级会话统计 store，变更即时刷新；刷新页面即清零 */
export function SimStats({ sim, items }: { sim: string; items: StatItem[] }) {
  useSyncExternalStore(subscribeStats, getStatVersion);
  return (
    <Group gap="lg" wrap="wrap" className={s.stats}>
      {items.map((it) => (
        <Text key={it.key} size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {it.label}
          <Text span size="xs" mx={5} className={s.statVal}>
            {it.format ? it.format(statGet(sim, it.key)) : statGet(sim, it.key)}
          </Text>
        </Text>
      ))}
    </Group>
  );
}

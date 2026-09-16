import { useEffect } from 'react';
import { ActionIcon, Group, Kbd, Slider, Text, Tooltip } from '@mantine/core';
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconRestore,
} from '@tabler/icons-react';
import { viz } from '../core/engine';
import { useVisualization } from '../hooks/useVisualization';
import classes from './Player.module.scss';

/** 时间轴播放器：播放/暂停/步进/进度/速度，对应原版 Player + ProgressBar */
export function Player() {
  useVisualization();
  const { chunks, cursor, playing, speed } = viz;

  useEffect(() => {
    if (!playing) return;
    // advance 只推进不改 playing；返回 false 即到末尾，停下
    const timer = setInterval(() => {
      if (!viz.advance()) viz.pause();
    }, viz.interval);
    return () => clearInterval(timer);
  }, [playing, speed]);

  const canPrev = viz.isValidCursor(cursor - 1);
  const canNext = viz.isValidCursor(cursor + 1);
  // 速度滑杆是指数映射（interval = 4000/e^speed），以默认档 speed=2 为 1× 基准显示相对倍率
  const rate = Math.exp(speed - 2);

  // 键盘学习快捷键：空格播放/暂停，左右键步进（输入框聚焦时忽略）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      // 焦点在滑杆上时，左右键已由 Slider 原生处理，忽略避免双重步进
      const onSlider = el?.getAttribute('role') === 'slider';
      if (e.code === 'Space') {
        e.preventDefault();
        if (playing) viz.pause();
        else viz.resume(true);
      } else if (e.key === 'ArrowRight' && !onSlider) {
        viz.next();
      } else if (e.key === 'ArrowLeft' && !onSlider) {
        viz.prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  return (
    <div className={classes.player}>
      <Group gap="xs" wrap="nowrap" flex={1}>
        <Tooltip label="回到开头">
          <ActionIcon variant="default" disabled={!canPrev} onClick={() => viz.seek(1)} aria-label="回到开头">
            <IconRestore size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="上一步">
          <ActionIcon variant="default" disabled={!canPrev} onClick={() => viz.prev()} aria-label="上一步">
            <IconPlayerTrackPrev size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={playing ? '暂停' : '播放'}>
          <ActionIcon
            variant={playing ? 'light' : 'filled'}
            color="violet"
            disabled={chunks.length === 0}
            onClick={() => (playing ? viz.pause() : viz.resume(true))}
            aria-label={playing ? '暂停' : '播放'}
          >
            {playing ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}
          </ActionIcon>
        </Tooltip>
        <Tooltip label="下一步">
          <ActionIcon variant="default" disabled={!canNext} onClick={() => viz.next()} aria-label="下一步">
            <IconPlayerTrackNext size={16} />
          </ActionIcon>
        </Tooltip>
        <Slider
          className={classes.progress}
          min={1}
          max={Math.max(chunks.length, 1)}
          value={cursor}
          disabled={chunks.length === 0}
          onChange={(v) => viz.seek(v)}
          label={(v) => `步骤 ${v} / ${chunks.length}`}
          aria-label="播放进度"
        />
        <Text size="xs" c="dimmed" className={classes.counter} visibleFrom="xs">
          {cursor} / {chunks.length}
        </Text>
      </Group>
      <Group gap="xs" wrap="nowrap" className={classes.speedGroup}>
        <Text size="xs" c="dimmed" visibleFrom="sm">速度</Text>
        <Slider
          className={classes.speed}
          min={0}
          max={4}
          step={0.5}
          value={speed}
          onChange={(v) => viz.setSpeed(v)}
          aria-label="播放速度"
        />
        <Text size="xs" c="dimmed" className={classes.counter} visibleFrom="sm">
          ×{rate.toFixed(1)}
        </Text>
        <Kbd visibleFrom="md">Space</Kbd>
        <Kbd visibleFrom="md">←→</Kbd>
      </Group>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Group, Text, Tooltip } from '@mantine/core';
import { IconEraser, IconPlayerTrackNext } from '@tabler/icons-react';
import { mulberry32, randomSeed } from '../core/random';
import { DiceButton, ParamSlider, PlayButton, SimStats } from './controls';
import { drawHud, fitCanvas, simColors, statAdd, statMax, useSimLoop, type SimProps } from './shared';
import s from './shared.module.scss';

const CELL = 12;

interface World {
  w: number;
  h: number;
  cols: number;
  rows: number;
  grid: Uint8Array;
  buf: Uint8Array;
  heat: Float32Array;
  gen: number;
  pop: number; // 当前种群
  prevPop: number; // 上一代种群，供熄灭判定
}

/** B3/S23，环面拓扑；热尾迹记录刚死去的细胞供淡出渲染 */
function build(w: number, h: number, seed: number, density: number): World {
  const cols = Math.max(8, Math.floor(w / CELL));
  const rows = Math.max(8, Math.floor(h / CELL));
  const grid = new Uint8Array(cols * rows);
  const rand = mulberry32(seed);
  let pop = 0;
  for (let i = 0; i < grid.length; i++) {
    grid[i] = rand() < density ? 1 : 0;
    if (grid[i]) pop++;
  }
  return {
    w, h, cols, rows, grid,
    buf: new Uint8Array(cols * rows),
    heat: new Float32Array(cols * rows),
    gen: 0,
    pop,
    prevPop: pop,
  };
}

function step(wd: World) {
  const { cols, rows, grid, buf, heat } = wd;
  for (let y = 0; y < rows; y++) {
    const yu = ((y - 1 + rows) % rows) * cols;
    const ym = y * cols;
    const yd = ((y + 1) % rows) * cols;
    for (let x = 0; x < cols; x++) {
      const xl = (x - 1 + cols) % cols;
      const xr = (x + 1) % cols;
      const n =
        grid[yu + xl] + grid[yu + x] + grid[yu + xr] +
        grid[ym + xl] + grid[ym + xr] +
        grid[yd + xl] + grid[yd + x] + grid[yd + xr];
      const i = ym + x;
      buf[i] = grid[i] ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
    }
  }
  wd.grid.set(buf);
  let pop = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i]) {
      heat[i] = 1;
      pop++;
    } else heat[i] *= 0.86;
  }
  wd.pop = pop;
  wd.gen++;
  statAdd('sim-life', 'gens');
  statMax('sim-life', 'peak', pop);
  if (pop === 0 && wd.prevPop > 0) statAdd('sim-life', 'ext');
  wd.prevPop = pop;
}

function render(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  wd: World,
  c: ReturnType<typeof simColors>,
) {
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  const { cols, rows, grid, heat } = wd;
  const ox = (w - cols * CELL) / 2;
  const oy = (h - rows * CELL) / 2;
  ctx.fillStyle = c.accent;
  for (let i = 0; i < grid.length; i++) {
    const px = ox + (i % cols) * CELL + 1;
    const py = oy + ((i / cols) | 0) * CELL + 1;
    if (grid[i]) {
      ctx.fillRect(px, py, CELL - 2, CELL - 2);
    } else if (heat[i] > 0.04) {
      ctx.globalAlpha = heat[i] * 0.22;
      ctx.fillRect(px, py, CELL - 2, CELL - 2);
      ctx.globalAlpha = 1;
    }
  }
  drawHud(ctx, `第 ${wd.gen} 代 · 种群 ${wd.pop}`, c.dim);
}

/** 生命游戏：B3/S23 元胞自动机，环面拓扑，支持拖拽绘制 */
export function SimLife({ scheme }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const accRef = useRef(0);
  const paintRef = useRef({ down: false, val: 1 });
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(12);
  const [density, setDensity] = useState(0.28);
  const [seed, setSeed] = useState(() => randomSeed());

  // seed/密度变化即时重建；暂停时也手动绘一帧
  useEffect(() => {
    const canvas = canvasRef.current;
    const c = canvas ? fitCanvas(canvas) : null;
    if (!c) return;
    worldRef.current = build(c.w, c.h, seed, density);
    render(c.ctx, c.w, c.h, worldRef.current, simColors(scheme));
  }, [seed, density, scheme]);

  useSimLoop(canvasRef, running, (ctx, w, h, dt) => {
    let wd = worldRef.current;
    if (!wd || wd.w !== w || wd.h !== h) wd = worldRef.current = build(w, h, seed, density);
    accRef.current += dt * speed;
    let n = Math.min(Math.floor(accRef.current), 8);
    accRef.current -= Math.floor(accRef.current);
    while (n-- > 0) step(wd);
    render(ctx, w, h, wd, simColors(scheme));
  });

  const drawNow = () => {
    const canvas = canvasRef.current;
    const wd = worldRef.current;
    const c = canvas ? fitCanvas(canvas) : null;
    if (c && wd) render(c.ctx, c.w, c.h, wd, simColors(scheme));
  };

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wd = worldRef.current;
    const canvas = canvasRef.current;
    if (!wd || !canvas) return -1;
    const rect = canvas.getBoundingClientRect();
    const ox = (wd.w - wd.cols * CELL) / 2;
    const oy = (wd.h - wd.rows * CELL) / 2;
    const x = Math.floor((e.clientX - rect.left - ox) / CELL);
    const y = Math.floor((e.clientY - rect.top - oy) / CELL);
    return x >= 0 && x < wd.cols && y >= 0 && y < wd.rows ? y * wd.cols + x : -1;
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wd = worldRef.current;
    if (!wd) return;
    const i = cellAt(e);
    if (i < 0) return;
    paintRef.current = { down: true, val: wd.grid[i] ? 0 : 1 };
    wd.grid[i] = paintRef.current.val;
    wd.pop += paintRef.current.val ? 1 : -1;
    wd.heat[i] = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawNow();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wd = worldRef.current;
    if (!wd || !paintRef.current.down) return;
    const i = cellAt(e);
    if (i >= 0 && wd.grid[i] !== paintRef.current.val) {
      wd.grid[i] = paintRef.current.val;
      wd.pop += paintRef.current.val ? 1 : -1;
      wd.heat[i] = 0;
      drawNow();
    }
  };

  const onUp = () => {
    paintRef.current.down = false;
  };

  const stepOnce = () => {
    const wd = worldRef.current;
    if (!wd) return;
    step(wd);
    drawNow();
  };

  const clear = () => {
    const wd = worldRef.current;
    if (!wd) return;
    wd.grid.fill(0);
    wd.heat.fill(0);
    wd.gen = 0;
    wd.pop = 0;
    drawNow();
  };

  return (
    <>
      <div className={s.frame}>
        <canvas
          ref={canvasRef}
          className={s.canvas}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        />
      </div>
      <Group gap="sm" wrap="wrap" className={s.controls}>
        <PlayButton running={running} onToggle={() => setRunning((r) => !r)} />
        <Tooltip label="单步一代">
          <ActionIcon variant="default" onClick={stepOnce} aria-label="单步">
            <IconPlayerTrackNext size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="清空画布">
          <ActionIcon variant="default" onClick={clear} aria-label="清空">
            <IconEraser size={16} />
          </ActionIcon>
        </Tooltip>
        <ParamSlider label="速度" value={speed} min={1} max={60} onChange={setSpeed} format={(v) => `${v} 代/秒`} />
        <ParamSlider
          label="初始密度"
          value={density}
          min={0.05}
          max={0.5}
          step={0.01}
          onChange={setDensity}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <DiceButton onClick={() => setSeed(randomSeed())} />
        <Text size="xs" c="dimmed" className={s.hint}>拖拽绘制细胞</Text>
      </Group>
      <SimStats
        sim="sim-life"
        items={[
          { key: 'gens', label: '累计世代' },
          { key: 'peak', label: '峰值种群' },
          { key: 'ext', label: '熄灭次数' },
        ]}
      />
    </>
  );
}

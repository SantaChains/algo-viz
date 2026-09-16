import { useRef, useState } from 'react';
import { Group } from '@mantine/core';
import { mulberry32, randomSeed } from '../core/random';
import { DiceButton, ParamSlider, PlayButton, SimStats } from './controls';
import { drawHud, simColors, statAdd, statSet, useSimLoop, type SimProps } from './shared';
import s from './shared.module.scss';

const CELL = 16;
const INF = -1;

interface Unit {
  x: number;
  y: number;
}

interface World {
  cols: number;
  rows: number;
  wall: Uint8Array;
  dist: Int32Array;
  units: Unit[];
  rand: () => number;
  builtSeed: number;
  builtDensity: number;
}

function build(w: number, h: number, seed: number, density: number): World {
  const cols = Math.max(8, Math.floor(w / CELL));
  const rows = Math.max(6, Math.floor(h / CELL));
  const wall = new Uint8Array(cols * rows);
  const rand = mulberry32(seed);
  // 随机游走生成墙团，留出边界
  const blobs = Math.round((cols * rows * density) / 10);
  for (let b = 0; b < blobs; b++) {
    let x = 1 + Math.floor(rand() * (cols - 2));
    let y = 1 + Math.floor(rand() * (rows - 2));
    const len = 4 + Math.floor(rand() * 10);
    for (let k = 0; k < len; k++) {
      wall[y * cols + x] = 1;
      x = Math.min(cols - 2, Math.max(1, x + Math.floor(rand() * 3) - 1));
      y = Math.min(rows - 2, Math.max(1, y + Math.floor(rand() * 3) - 1));
    }
  }
  return {
    cols, rows, wall,
    dist: new Int32Array(cols * rows),
    units: [],
    rand: mulberry32(seed ^ 0x7f4a7c15),
    builtSeed: seed,
    builtDensity: density,
  };
}

/** 以目标为源的 4 向 BFS 距离场（墙不可通） */
function bakeField(wd: World, tx: number, ty: number) {
  const { cols, rows, wall, dist } = wd;
  dist.fill(INF);
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows || wall[ty * cols + tx]) return;
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;
  dist[ty * cols + tx] = 0;
  queue[tail++] = ty * cols + tx;
  while (head < tail) {
    const cur = queue[head++];
    const d = dist[cur] + 1;
    const x = cur % cols;
    const y = (cur / cols) | 0;
    if (x > 0 && !wall[cur - 1] && dist[cur - 1] === INF) { dist[cur - 1] = d; queue[tail++] = cur - 1; }
    if (x < cols - 1 && !wall[cur + 1] && dist[cur + 1] === INF) { dist[cur + 1] = d; queue[tail++] = cur + 1; }
    if (y > 0 && !wall[cur - cols] && dist[cur - cols] === INF) { dist[cur - cols] = d; queue[tail++] = cur - cols; }
    if (y < rows - 1 && !wall[cur + cols] && dist[cur + cols] === INF) { dist[cur + cols] = d; queue[tail++] = cur + cols; }
  }
}

/** 距离更低的开格邻居，无则 -1 */
function lowerNeighbor(wd: World, gx: number, gy: number) {
  const gi = gy * wd.cols + gx;
  const nbs = [gi - 1, gi + 1, gi - wd.cols, gi + wd.cols];
  const ok = [
    gx > 0 && !wd.wall[nbs[0]] && wd.dist[nbs[0]] !== INF,
    gx < wd.cols - 1 && !wd.wall[nbs[1]] && wd.dist[nbs[1]] !== INF,
    gy > 0 && !wd.wall[nbs[2]] && wd.dist[nbs[2]] !== INF,
    gy < wd.rows - 1 && !wd.wall[nbs[3]] && wd.dist[nbs[3]] !== INF,
  ];
  let best = -1;
  for (let k = 0; k < 4; k++) {
    if (ok[k] && (best < 0 || wd.dist[nbs[k]] < wd.dist[best])) best = nbs[k];
  }
  return best;
}

function respawn(wd: World, u: Unit) {
  for (let k = 0; k < 24; k++) {
    const gx = Math.floor(wd.rand() * wd.cols);
    const gy = Math.floor(wd.rand() * wd.rows);
    if (!wd.wall[gy * wd.cols + gx]) {
      u.x = gx * CELL + CELL / 2;
      u.y = gy * CELL + CELL / 2;
      return;
    }
  }
  u.x = wd.cols * CELL / 2;
  u.y = wd.rows * CELL / 2;
}

/** RTS 流场寻路：目标为源的 BFS 位势场一次驱动全部单位，点击画布更换集结点 */
export function SimRTS({ scheme }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const layerRef = useRef<{ cv: HTMLCanvasElement; key: string; maxDepth: number } | null>(null);
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const [running, setRunning] = useState(true);
  const [count, setCount] = useState(24);
  const [density, setDensity] = useState(0.35);
  const [speed, setSpeed] = useState(1);
  const [seed, setSeed] = useState(() => randomSeed());

  useSimLoop(canvasRef, running, (ctx, w, h, dt) => {
    const colors = simColors(scheme);
    let wd = worldRef.current;
    if (!wd || wd.builtSeed !== seed || wd.builtDensity !== density) {
      wd = worldRef.current = build(w, h, seed, density);
      layerRef.current = null;
      targetRef.current = null;
    }

    const t = targetRef.current ?? { x: wd.cols >> 1, y: wd.rows >> 1 };
    const open = wd.wall[t.y * wd.cols + t.x] ? null : t;
    const goal = open ?? { x: wd.cols >> 1, y: wd.rows >> 1 };

    // 静态层（背景 + 距离场热力 + 流向 + 墙）缓存
    const layerKey = `${seed}|${density}|${goal.x},${goal.y}|${w}x${h}|${scheme}`;
    let layer = layerRef.current;
    if (!layer || layer.key !== layerKey) {
      bakeField(wd, goal.x, goal.y);
      let maxDepth = 0;
      for (let i = 0; i < wd.dist.length; i++) if (wd.dist[i] > maxDepth) maxDepth = wd.dist[i];
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const c2 = cv.getContext('2d');
      if (c2) {
        c2.fillStyle = colors.bg;
        c2.fillRect(0, 0, w, h);
        let maxD = 1;
        for (let i = 0; i < wd.dist.length; i++) if (wd.dist[i] > maxD) maxD = wd.dist[i];
        for (let gy = 0; gy < wd.rows; gy++) {
          for (let gx = 0; gx < wd.cols; gx++) {
            const i = gy * wd.cols + gx;
            if (wd.wall[i]) continue;
            const d = wd.dist[i];
            if (d > 0) {
              c2.globalAlpha = 0.12 * Math.pow(1 - d / maxD, 1.5);
              c2.fillStyle = colors.accent;
              c2.fillRect(gx * CELL + 1, gy * CELL + 1, CELL - 2, CELL - 2);
              c2.globalAlpha = 1;
            }
            const best = lowerNeighbor(wd, gx, gy);
            if (best >= 0) {
              const cx = gx * CELL + CELL / 2;
              const cy = gy * CELL + CELL / 2;
              const nx = (best % wd.cols) * CELL + CELL / 2;
              const ny = ((best / wd.cols) | 0) * CELL + CELL / 2;
              c2.globalAlpha = 0.26;
              c2.strokeStyle = colors.dim;
              c2.lineWidth = 1;
              c2.beginPath();
              c2.moveTo(cx, cy);
              c2.lineTo(cx + (nx - cx) * 0.55, cy + (ny - cy) * 0.55);
              c2.stroke();
              c2.globalAlpha = 1;
            }
          }
        }
        c2.fillStyle = colors.wall;
        for (let gy = 0; gy < wd.rows; gy++) {
          for (let gx = 0; gx < wd.cols; gx++) {
            if (wd.wall[gy * wd.cols + gx]) c2.fillRect(gx * CELL, gy * CELL, CELL - 1, CELL - 1);
          }
        }
      }
      layer = layerRef.current = { cv, key: layerKey, maxDepth };
      statSet('sim-rts', 'depth', maxDepth);
    }
    ctx.drawImage(layer.cv, 0, 0);

    // 目标脉冲
    const cx = goal.x * CELL + CELL / 2;
    const cy = goal.y * CELL + CELL / 2;
    ctx.strokeStyle = colors.good;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 7 + Math.sin(performance.now() / 280) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = colors.good;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // 单位数跟随参数；沿场移动，抵达目标即重生
    while (wd.units.length < count) {
      const u = { x: 0, y: 0 };
      respawn(wd, u);
      wd.units.push(u);
    }
    if (wd.units.length > count) wd.units.length = count;

    const v = 70 * speed;
    ctx.fillStyle = colors.accent;
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 1;
    for (const u of wd.units) {
      const gx = Math.min(wd.cols - 1, Math.max(0, Math.floor(u.x / CELL)));
      const gy = Math.min(wd.rows - 1, Math.max(0, Math.floor(u.y / CELL)));
      if (wd.dist[gy * wd.cols + gx] === 0) {
        respawn(wd, u);
        statAdd('sim-rts', 'arrivals');
        continue;
      }
      const best = lowerNeighbor(wd, gx, gy);
      if (best >= 0) {
        const tx = (best % wd.cols) * CELL + CELL / 2;
        const ty = ((best / wd.cols) | 0) * CELL + CELL / 2;
        const dx = tx - u.x;
        const dy = ty - u.y;
        const len = Math.hypot(dx, dy) || 1;
        const stepLen = v * dt;
        if (len <= stepLen) {
          u.x = tx;
          u.y = ty;
        } else {
          u.x += (dx / len) * stepLen;
          u.y += (dy / len) * stepLen;
        }
      }
      ctx.beginPath();
      ctx.arc(u.x, u.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    drawHud(ctx, `单位 ${wd.units.length} · 场深 ${layer.maxDepth ?? '—'} 格`, colors.dim);
  });

  const pickTarget = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wd = worldRef.current;
    const canvas = canvasRef.current;
    if (!wd || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const gx = Math.floor((e.clientX - rect.left) / CELL);
    const gy = Math.floor((e.clientY - rect.top) / CELL);
    // 命中墙则就近找开格
    for (let r = 0; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = gx + dx;
          const y = gy + dy;
          if (x >= 0 && x < wd.cols && y >= 0 && y < wd.rows && !wd.wall[y * wd.cols + x]) {
            targetRef.current = { x, y };
            statAdd('sim-rts', 'rally');
            return;
          }
        }
      }
    }
  };

  return (
    <>
      <div className={s.frame}>
        <canvas ref={canvasRef} className={s.canvas} onPointerDown={pickTarget} />
      </div>
      <div style={{ height: 8 }} />
      <Group gap="sm" wrap="wrap" className={s.controls}>
        <PlayButton running={running} onToggle={() => setRunning((r) => !r)} />
        <ParamSlider label="单位数" value={count} min={1} max={80} onChange={setCount} />
        <ParamSlider
          label="障碍密度"
          value={density}
          min={0}
          max={0.6}
          step={0.05}
          onChange={setDensity}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <ParamSlider
          label="速度"
          value={speed}
          min={0.5}
          max={3}
          step={0.5}
          onChange={setSpeed}
          format={(v) => `${v}×`}
        />
        <DiceButton
          onClick={() => {
            setSeed(randomSeed());
            targetRef.current = null;
          }}
        />
        <span className={s.hint} style={{ fontSize: 12, color: 'var(--mantine-color-dimmed)' }}>
          点击画布更换集结点
        </span>
      </Group>
      <SimStats
        sim="sim-rts"
        items={[
          { key: 'rally', label: '集结变更' },
          { key: 'arrivals', label: '到达次数' },
          { key: 'depth', label: '当前场深', format: (v) => `${v} 格` },
        ]}
      />
    </>
  );
}

import { useRef, useState } from 'react';
import { Group } from '@mantine/core';
import { mulberry32, randomSeed } from '../core/random';
import { DiceButton, ParamSlider, PlayButton, SimStats } from './controls';
import {
  drawHud,
  simColors,
  statAdd,
  statGet,
  statMax,
  statSet,
  useSimLoop,
  type SimProps,
} from './shared';
import s from './shared.module.scss';

const TAU = Math.PI * 2;
const SEP_RATIO = 0.45; // 分离半径 = 视野 × 比例
const MAX_STEER = 220; // 单帧转向力上限（px/s²）
const MIN_RATIO = 0.35; // 最低速度比例，防止个体停滞

interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface World {
  boids: Boid[];
  rand: () => number;
  builtSeed: number;
  gridHead: Int32Array;
  gridNext: Int32Array;
  gcols: number;
  grows: number;
}

/** 环面最短位移：邻居判定跨越边界时取 wrap 方向 */
function wrapD(d: number, span: number) {
  if (d > span / 2) return d - span;
  if (d < -span / 2) return d + span;
  return d;
}

/** 均匀网格重建：链表头插入，O(n) 分桶供 3×3 邻域查询 */
function rebuildGrid(wd: World, w: number, h: number, view: number) {
  const gcols = Math.max(1, Math.floor(w / view));
  const grows = Math.max(1, Math.floor(h / view));
  if (wd.gridHead.length !== gcols * grows) wd.gridHead = new Int32Array(gcols * grows);
  wd.gcols = gcols;
  wd.grows = grows;
  if (wd.gridNext.length < wd.boids.length) wd.gridNext = new Int32Array(wd.boids.length);
  wd.gridHead.fill(-1);
  for (let i = 0; i < wd.boids.length; i++) {
    const b = wd.boids[i];
    const gc = Math.min(gcols - 1, Math.max(0, Math.floor((b.x / w) * gcols)));
    const gr = Math.min(grows - 1, Math.max(0, Math.floor((b.y / h) * grows)));
    const gi = gr * gcols + gc;
    wd.gridNext[i] = wd.gridHead[gi];
    wd.gridHead[gi] = i;
  }
}

/** Boids 群体：Reynolds 三规则（分离/对齐/聚合）驱动自组织鸟群 */
export function SimBoids({ scheme }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const [running, setRunning] = useState(true);
  const [count, setCount] = useState(160);
  const [view, setView] = useState(48);
  const [wSep, setWSep] = useState(1.5);
  const [wAli, setWAli] = useState(1.0);
  const [wCoh, setWCoh] = useState(0.8);
  const [maxSp, setMaxSp] = useState(110);
  const [seed, setSeed] = useState(() => randomSeed());

  useSimLoop(canvasRef, running, (ctx, w, h, dt) => {
    const colors = simColors(scheme);
    let wd = worldRef.current;
    if (!wd || wd.builtSeed !== seed) {
      const rand = mulberry32(seed);
      const boids: Boid[] = Array.from({ length: count }, () => {
        const ang = rand() * TAU;
        return {
          x: rand() * w,
          y: rand() * h,
          vx: Math.cos(ang) * maxSp * 0.7,
          vy: Math.sin(ang) * maxSp * 0.7,
        };
      });
      wd = worldRef.current = {
        boids,
        rand,
        builtSeed: seed,
        gridHead: new Int32Array(0),
        gridNext: new Int32Array(0),
        gcols: 0,
        grows: 0,
      };
    }
    // 个体数跟随参数
    while (wd.boids.length < count) {
      const ang = wd.rand() * TAU;
      wd.boids.push({ x: wd.rand() * w, y: wd.rand() * h, vx: Math.cos(ang) * maxSp * 0.7, vy: Math.sin(ang) * maxSp * 0.7 });
    }
    if (wd.boids.length > count) wd.boids.length = count;
    if (wd.gridNext.length < wd.boids.length) wd.gridNext = new Int32Array(wd.boids.length);

    rebuildGrid(wd, w, h, view);
    const sepR = view * SEP_RATIO;

    // ---- 三规则更新 ----
    const { gcols, grows, gridHead, gridNext } = wd;
    const step = Math.min(dt, 0.033);
    let nbSum = 0;
    for (let i = 0; i < wd.boids.length; i++) {
      const b = wd.boids[i];
      const gc = Math.min(gcols - 1, Math.max(0, Math.floor((b.x / w) * gcols)));
      const gr = Math.min(grows - 1, Math.max(0, Math.floor((b.y / h) * grows)));
      let sepX = 0, sepY = 0, aliX = 0, aliY = 0, cohX = 0, cohY = 0, nAli = 0;
      for (let dr = -1; dr <= 1; dr++) {
        const rr = (gr + dr + grows) % grows;
        for (let dc = -1; dc <= 1; dc++) {
          const cc = (gc + dc + gcols) % gcols;
          for (let j = gridHead[rr * gcols + cc]; j >= 0; j = gridNext[j]) {
            if (j === i) continue;
            const o = wd.boids[j];
            const dx = wrapD(o.x - b.x, w);
            const dy = wrapD(o.y - b.y, h);
            const d2 = dx * dx + dy * dy;
            if (d2 > view * view || d2 === 0) continue;
            aliX += o.vx;
            aliY += o.vy;
            cohX += dx;
            cohY += dy;
            nAli++;
            if (d2 < sepR * sepR) {
              const inv = 1 / d2; // 距离平方反比：越近推力越强
              sepX -= dx * inv;
              sepY -= dy * inv;
            }
          }
        }
      }
      if (nAli > 0) {
        // 对齐/聚合按邻居数归一，分离向量模长即推力大小
        const steerX = sepX * 60 * wSep + (aliX / nAli - b.vx) * wAli + (cohX / nAli) * 1.2 * wCoh;
        const steerY = sepY * 60 * wSep + (aliY / nAli - b.vy) * wAli + (cohY / nAli) * 1.2 * wCoh;
        const mag = Math.hypot(steerX, steerY);
        if (mag > MAX_STEER) {
          b.vx += (steerX / mag) * MAX_STEER * step;
          b.vy += (steerY / mag) * MAX_STEER * step;
        } else {
          b.vx += steerX * step;
          b.vy += steerY * step;
        }
      }
      nbSum += nAli;
      // 限速：保底防停滞，封顶防爆走
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const target = Math.min(maxSp, Math.max(maxSp * MIN_RATIO, sp));
      b.vx = (b.vx / sp) * target;
      b.vy = (b.vy / sp) * target;
      b.x = (b.x + b.vx * step + w) % w;
      b.y = (b.y + b.vy * step + h) % h;
    }

    // 会话统计：平均邻居数 EMA 平滑 + 峰值个体
    const avgNb = wd.boids.length ? nbSum / wd.boids.length : 0;
    statSet('sim-boids', 'nb', Math.round(statGet('sim-boids', 'nb') * 0.9 + avgNb * 0.1));
    statMax('sim-boids', 'peak', wd.boids.length);

    // ---- 渲染：三角形指向航向，色相 = 航向角 ----
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = colors.grid;
    for (let x = 0; x < w; x += 48) ctx.fillRect(x, 0, 1, h);
    for (let y = 0; y < h; y += 48) ctx.fillRect(0, y, w, 1);
    const light = scheme === 'light';
    for (const b of wd.boids) {
      const ang = Math.atan2(b.vy, b.vx);
      const hue = ((ang / TAU) * 360 + 360) % 360;
      ctx.fillStyle = `hsl(${hue} 68% ${light ? 44 : 62}%)`;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const px = 6;
      const mx = 3;
      const py = 3.4;
      ctx.beginPath();
      ctx.moveTo(b.x + cos * px, b.y + sin * px);
      ctx.lineTo(b.x - cos * mx - sin * py, b.y - sin * mx + cos * py);
      ctx.lineTo(b.x - cos * mx + sin * py, b.y - sin * mx - cos * py);
      ctx.closePath();
      ctx.fill();
    }

    drawHud(ctx, `个体 ${wd.boids.length} · 视野 ${view}px`, colors.dim);
  });

  return (
    <>
      <div className={s.frame}>
        <canvas ref={canvasRef} className={s.canvas} />
      </div>
      <Group gap="sm" wrap="wrap" className={s.controls}>
        <PlayButton running={running} onToggle={() => setRunning((r) => !r)} />
        <ParamSlider label="个体数" value={count} min={30} max={400} step={10} onChange={setCount} />
        <ParamSlider label="视野" value={view} min={24} max={120} onChange={setView} format={(v) => `${v}px`} />
        <ParamSlider label="分离" value={wSep} min={0} max={3} step={0.1} onChange={setWSep} format={(v) => v.toFixed(1)} />
        <ParamSlider label="对齐" value={wAli} min={0} max={3} step={0.1} onChange={setWAli} format={(v) => v.toFixed(1)} />
        <ParamSlider label="聚合" value={wCoh} min={0} max={3} step={0.1} onChange={setWCoh} format={(v) => v.toFixed(1)} />
        <ParamSlider label="速度上限" value={maxSp} min={40} max={200} step={10} onChange={setMaxSp} format={(v) => `${v}px/s`} />
        <DiceButton
          onClick={() => {
            statAdd('sim-boids', 'reseeds');
            setSeed(randomSeed());
          }}
        />
      </Group>
      <SimStats
        sim="sim-boids"
        items={[
          { key: 'peak', label: '峰值个体' },
          { key: 'nb', label: '平均邻居' },
          { key: 'reseeds', label: '换种次数' },
        ]}
      />
    </>
  );
}

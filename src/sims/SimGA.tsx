import { useEffect, useRef, useState } from 'react';
import { Group } from '@mantine/core';
import { mulberry32, randomSeed } from '../core/random';
import { DiceButton, ParamSlider, PlayButton, SimStats } from './controls';
import { clamp01, drawHud, simColors, statAdd, statMax, useSimLoop, type SimProps } from './shared';
import s from './shared.module.scss';

/** 多峰适应度地形：双波纹叠加，域 [0,1]² */
const F = (x: number, y: number) =>
  Math.sin(Math.PI * 2 * x) * Math.sin(Math.PI * 2 * y) +
  0.6 * Math.sin(Math.PI * 4 * x + Math.PI * y);

interface Ind {
  x: number;
  y: number;
}

interface World {
  pop: Ind[];
  rand: () => number;
  gen: number;
  best: number;
}

interface Params {
  size: number;
  elite: number;
  tour: number;
  mutRate: number;
  mutScale: number;
}

/** 锦标赛选择 + BLX-α 混合交叉 + 高斯变异 + 精英保留（实数编码标准算子组合） */
function evolve(wd: World, p: Params) {
  const scored = wd.pop
    .map((ind) => ({ ind, f: F(ind.x, ind.y) }))
    .sort((a, b) => b.f - a.f);
  wd.best = scored[0].f;
  statMax('sim-ga', 'best', wd.best);
  const next: Ind[] = [];
  for (let i = 0; i < p.elite && i < scored.length; i++) next.push({ ...scored[i].ind });
  const pick = () => {
    let winner = scored[Math.floor(wd.rand() * scored.length)];
    for (let k = 1; k < p.tour; k++) {
      const c = scored[Math.floor(wd.rand() * scored.length)];
      if (c.f > winner.f) winner = c;
    }
    return winner.ind;
  };
  // Box-Muller 高斯噪声：后期收敛更平滑，无均匀变异的固定步长抖动
  const gauss = () => {
    const u = Math.max(wd.rand(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * wd.rand());
  };
  const ALPHA = 0.5; // BLX-α：子代在父本区间外扩 α·|差| 的范围内均匀取值
  while (next.length < p.size) {
    const a = pick();
    const b = pick();
    const mix = (u: number, v: number) => {
      const lo = Math.min(u, v);
      const d = Math.abs(u - v);
      const span = d * (1 + 2 * ALPHA) || 0.02; // 双亲重合时给微小探索窗，避免停滞
      return clamp01(lo - ALPHA * d + wd.rand() * span);
    };
    let x = mix(a.x, b.x);
    let y = mix(a.y, b.y);
    if (wd.rand() < p.mutRate) x = clamp01(x + gauss() * p.mutScale);
    if (wd.rand() < p.mutRate) y = clamp01(y + gauss() * p.mutScale);
    next.push({ x, y });
  }
  wd.pop = next;
  wd.gen++;
  statAdd('sim-ga', 'gens');
}

/** 适应度热力图缓存：粗采样定值域，再逐像素映射到主题渐变 */
function renderHeat(w: number, h: number, scheme: 'light' | 'dark') {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c2 = cv.getContext('2d');
  if (!c2) return cv;
  const img = c2.createImageData(w, h);
  const S = 96;
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j <= S; j++) {
    for (let i = 0; i <= S; i++) {
      const f = F(i / S, j / S);
      if (f < min) min = f;
      if (f > max) max = f;
    }
  }
  const dark = scheme === 'dark';
  const lo = dark ? [17, 15, 24] : [245, 243, 251];
  const hi = dark ? [151, 117, 250] : [94, 61, 196];
  const span = max - min || 1;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let t = Math.pow(clamp01((F(i / w, j / h) - min) / span), 1.25);
      const k = (j * w + i) * 4;
      img.data[k] = lo[0] + (hi[0] - lo[0]) * t;
      img.data[k + 1] = lo[1] + (hi[1] - lo[1]) * t;
      img.data[k + 2] = lo[2] + (hi[2] - lo[2]) * t;
      img.data[k + 3] = 255;
    }
  }
  c2.putImageData(img, 0, 0);
  return cv;
}

/** 遗传算法：种群散点在适应度地形上逐代向峰值收敛 */
export function SimGA({ scheme }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const heatRef = useRef<{ cv: HTMLCanvasElement; w: number; h: number; scheme: string } | null>(null);
  const accRef = useRef(0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(8);
  const [size, setSize] = useState(80);
  const [tour, setTour] = useState(3);
  const [mutRate, setMutRate] = useState(0.15);
  const [mutScale, setMutScale] = useState(0.08);
  const [seed, setSeed] = useState(() => randomSeed());

  useEffect(() => {
    const rand = mulberry32(seed);
    const pop: Ind[] = Array.from({ length: size }, () => ({ x: rand(), y: rand() }));
    worldRef.current = { pop, rand: mulberry32(seed ^ 0x9e3779b9), gen: 0, best: 0 };
    heatRef.current = null;
  }, [seed, size]);

  useSimLoop(canvasRef, running, (ctx, w, h, dt) => {
    const wd = worldRef.current;
    if (!wd) return;
    const p = { size, elite: Math.min(6, Math.floor(size * 0.06)), tour, mutRate, mutScale };
    while (wd.pop.length < p.size) wd.pop.push({ x: wd.rand(), y: wd.rand() });
    if (wd.pop.length > p.size) wd.pop.length = p.size;

    accRef.current += dt * speed;
    const n = Math.min(Math.floor(accRef.current), 6);
    accRef.current -= Math.floor(accRef.current);
    for (let i = 0; i < n; i++) evolve(wd, p);

    let heat = heatRef.current;
    if (!heat || heat.w !== w || heat.h !== h || heat.scheme !== scheme) {
      heat = heatRef.current = { cv: renderHeat(w, h, scheme), w, h, scheme };
    }
    ctx.drawImage(heat.cv, 0, 0, w, h);

    const c = simColors(scheme);
    // 最佳个体标记 + 种群散点（顺带累加平均适应度）
    const best = { x: 0, y: 0, f: -Infinity };
    let fsum = 0;
    ctx.fillStyle = c.text;
    for (const ind of wd.pop) {
      const f = F(ind.x, ind.y);
      fsum += f;
      if (f > best.f) {
        best.x = ind.x;
        best.y = ind.y;
        best.f = f;
      }
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(ind.x * w, (1 - ind.y) * h, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = c.warn;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(best.x * w, (1 - best.y) * h, 6, 0, Math.PI * 2);
    ctx.stroke();

    const avg = wd.pop.length ? fsum / wd.pop.length : 0;
    drawHud(ctx, `第 ${wd.gen} 代 · 最佳 ${best.f.toFixed(3)} · 平均 ${avg.toFixed(3)}`, scheme === 'dark' ? '#c8c8d4' : '#55555f');
  });

  return (
    <>
      <div className={s.frame}>
        <canvas ref={canvasRef} className={s.canvas} />
      </div>
      <Group gap="sm" wrap="wrap" className={s.controls}>
        <PlayButton running={running} onToggle={() => setRunning((r) => !r)} />
        <ParamSlider label="种群" value={size} min={20} max={240} step={10} onChange={setSize} />
        <ParamSlider
          label="进化速度"
          value={speed}
          min={1}
          max={30}
          onChange={setSpeed}
          format={(v) => `${v} 代/秒`}
        />
        <ParamSlider label="锦标赛" value={tour} min={2} max={5} onChange={setTour} format={(v) => `${v} 选 1`} />
        <ParamSlider
          label="变异率"
          value={mutRate}
          min={0.02}
          max={0.9}
          step={0.01}
          onChange={setMutRate}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <ParamSlider
          label="变异幅度"
          value={mutScale}
          min={0.01}
          max={0.3}
          step={0.01}
          onChange={setMutScale}
          format={(v) => v.toFixed(2)}
        />
        <DiceButton
          onClick={() => {
            statAdd('sim-ga', 'seeds');
            setSeed(randomSeed());
          }}
        />
      </Group>
      <SimStats
        sim="sim-ga"
        items={[
          { key: 'gens', label: '累计代数' },
          { key: 'best', label: '历史最佳', format: (v) => v.toFixed(3) },
          { key: 'seeds', label: '换种次数' },
        ]}
      />
    </>
  );
}

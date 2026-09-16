import { useCallback, useEffect, useRef, useState } from 'react';
import { Group, Text } from '@mantine/core';
import { mulberry32, randomSeed } from '../core/random';
import { DiceButton, ParamSlider, PlayButton, SimStats } from './controls';
import { drawHud, fitCanvas, simColors, statAdd, statMax, useSimLoop, type SimProps } from './shared';
import s from './shared.module.scss';

const TAU = Math.PI * 2;

interface Creature {
  x: number;
  y: number;
  dir: number;
  energy: number;
  speed: number; // 速度基因 0.4 ~ 3.2
  sense: number; // 感知基因 16 ~ 130 px
  age: number;
}

interface Food {
  x: number;
  y: number;
}

interface World {
  creatures: Creature[];
  foods: Food[];
  rand: () => number;
  builtSeed: number;
}

function randomCreature(rand: () => number, w: number, h: number, energy = 24 + rand() * 10): Creature {
  return {
    x: rand() * w,
    y: rand() * h,
    dir: rand() * TAU,
    energy,
    speed: 0.5 + rand() * 1.6,
    sense: 30 + rand() * 70,
    age: 0,
  };
}

function build(w: number, h: number, seed: number): World {
  const rand = mulberry32(seed);
  const wd: World = { creatures: [], foods: [], rand, builtSeed: seed };
  for (let i = 0; i < 14; i++) wd.creatures.push(randomCreature(rand, w, h));
  for (let i = 0; i < 90; i++) wd.foods.push({ x: rand() * w, y: rand() * h });
  return wd;
}

const clampGene = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** 生存进化：速度/感知基因决定觅食效率，进食繁殖、耗能死亡，突变驱动基因漂移 */
export function SimEvo({ scheme }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const [running, setRunning] = useState(true);
  const [foodCap, setFoodCap] = useState(120);
  const [mutScale, setMutScale] = useState(0.15);
  const [metabolic, setMetabolic] = useState(1.2);
  const [simSpeed, setSimSpeed] = useState(1);
  const [seed, setSeed] = useState(() => randomSeed());

  const renderWorld = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, wd: World) => {
      const colors = simColors(scheme);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = colors.grid;
      for (let x = 0; x < w; x += 40) ctx.fillRect(x, 0, 1, h);
      for (let y = 0; y < h; y += 40) ctx.fillRect(0, y, w, 1);
      ctx.fillStyle = colors.good;
      for (const f of wd.foods) ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3);
      for (const c of wd.creatures) {
        // 色相随速度基因：慢蓝 -> 快橙，大小 = 能量
        ctx.fillStyle = `hsl(${230 - c.speed * 55} 70% ${scheme === 'dark' ? 62 : 46}%)`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3 + Math.min(c.energy, 50) * 0.07, 0, TAU);
        ctx.fill();
      }
      const pop = wd.creatures.length;
      const avgS = pop ? wd.creatures.reduce((a, c) => a + c.speed, 0) / pop : 0;
      const avgE = pop ? wd.creatures.reduce((a, c) => a + c.sense, 0) / pop : 0;
      drawHud(ctx, `种群 ${pop} · 均速 ${avgS.toFixed(2)} · 均感 ${avgE.toFixed(0)}`, colors.dim);
    },
    [scheme],
  );

  useSimLoop(canvasRef, running, (ctx, w, h, dt) => {
    let wd = worldRef.current;
    if (!wd || wd.builtSeed !== seed) wd = worldRef.current = build(w, h, seed);

    const step = dt * simSpeed;
    if (step > 0) {
      const { rand } = wd;
      // 食物按容量缺口再生
      const grow = Math.min(foodCap - wd.foods.length, Math.ceil((foodCap * 0.35 + 2) * step));
      for (let i = 0; i < grow; i++) wd.foods.push({ x: rand() * w, y: rand() * h });

      const born: Creature[] = [];
      const alive: Creature[] = [];
      for (const c of wd.creatures) {
        // 觅食：感知半径内最近食物导向，否则随机漂移
        let target: Food | null = null;
        let bestD = c.sense;
        for (const f of wd.foods) {
          const d = Math.hypot(f.x - c.x, f.y - c.y);
          if (d < bestD) {
            bestD = d;
            target = f;
          }
        }
        if (target) {
          const want = Math.atan2(target.y - c.y, target.x - c.x);
          let diff = want - c.dir;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          const turn = 4 * step;
          c.dir += Math.abs(diff) < turn ? diff : Math.sign(diff) * turn;
        } else {
          c.dir += (rand() - 0.5) * 3 * step;
        }
        const v = c.speed * 42 * step;
        c.x = (c.x + Math.cos(c.dir) * v + w) % w;
        c.y = (c.y + Math.sin(c.dir) * v + h) % h;
        c.energy -= metabolic * (0.5 + c.speed * 0.6) * step;
        c.age += step;

        // 进食
        for (let i = wd.foods.length - 1; i >= 0; i--) {
          const f = wd.foods[i];
          if (Math.abs(f.x - c.x) < 7 && Math.abs(f.y - c.y) < 7) {
            wd.foods.splice(i, 1);
            c.energy += 18;
            break;
          }
        }

        // 繁殖：能量超阈值分裂，子代基因突变
        if (c.energy > 52 && wd.creatures.length + born.length < 240) {
          c.energy /= 2;
          born.push({
            x: c.x,
            y: c.y,
            dir: rand() * TAU,
            energy: c.energy,
            speed: clampGene(c.speed * (1 + (rand() - 0.5) * 2 * mutScale), 0.4, 3.2),
            sense: clampGene(c.sense * (1 + (rand() - 0.5) * 2 * mutScale), 16, 130),
            age: 0,
          });
        }
        if (c.energy > 0 && c.age < 90) alive.push(c);
      }
      wd.creatures = alive.concat(born);
      statAdd('sim-evo', 'births', born.length);
      statMax('sim-evo', 'peak', wd.creatures.length);
      if (wd.creatures.length === 0) statAdd('sim-evo', 'ext');
      // 灭绝保护：维持可观测种群
      while (wd.creatures.length < 4) wd.creatures.push(randomCreature(rand, w, h, 30));
    }

    renderWorld(ctx, w, h, wd);
  });

  // seed 变化：置空世界，播放态下一帧重建；暂停态立即重建并绘一帧
  useEffect(() => {
    const canvas = canvasRef.current;
    const c = canvas ? fitCanvas(canvas) : null;
    worldRef.current = c ? build(c.w, c.h, seed) : null;
    if (c && worldRef.current && !running) renderWorld(c.ctx, c.w, c.h, worldRef.current);
  }, [seed, running, scheme, renderWorld]);

  return (
    <>
      <div className={s.frame}>
        <canvas ref={canvasRef} className={s.canvas} />
      </div>
      <div style={{ height: 8 }} />
      <Group gap="sm" wrap="wrap" className={s.controls}>
        <PlayButton running={running} onToggle={() => setRunning((r) => !r)} />
        <ParamSlider label="食物上限" value={foodCap} min={20} max={300} step={10} onChange={setFoodCap} />
        <ParamSlider
          label="突变幅度"
          value={mutScale}
          min={0}
          max={0.5}
          step={0.01}
          onChange={setMutScale}
          format={(v) => v.toFixed(2)}
        />
        <ParamSlider
          label="代谢率"
          value={metabolic}
          min={0.4}
          max={3}
          step={0.1}
          onChange={setMetabolic}
          format={(v) => v.toFixed(1)}
        />
        <ParamSlider
          label="倍速"
          value={simSpeed}
          min={0.5}
          max={4}
          step={0.5}
          onChange={setSimSpeed}
          format={(v) => `${v}×`}
        />
        <DiceButton onClick={() => setSeed(randomSeed())} />
        <Text size="xs" c="dimmed" className={s.hint}>颜色 = 速度基因，大小 = 能量</Text>
      </Group>
      <SimStats
        sim="sim-evo"
        items={[
          { key: 'births', label: '累计出生' },
          { key: 'peak', label: '峰值种群' },
          { key: 'ext', label: '灭绝保护' },
        ]}
      />
    </>
  );
}

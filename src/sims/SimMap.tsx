import { useEffect, useRef, useState } from 'react';
import { Group } from '@mantine/core';
import { mulberry32, randomSeed } from '../core/random';
import { DiceButton, ParamSlider, SimStats } from './controls';
import { drawHud, fitCanvas, statAdd, statSet, useResize, type SimProps } from './shared';
import s from './shared.module.scss';

/** 种子化分形值噪声：格点值表 + smootherstep 插值 + 多倍频叠加 */
function makeTerrain(seed: number) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256);
  for (let i = 0; i < 256; i++) val[i] = rand();

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const noise = (x: number, y: number) => {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const X = fx & 255;
    const Y = fy & 255;
    const u = fade(x - fx);
    const v = fade(y - fy);
    const a = val[perm[perm[X] + Y]];
    const b = val[perm[perm[X + 1] + Y]];
    const c = val[perm[perm[X] + Y + 1]];
    const d = val[perm[perm[X + 1] + Y + 1]];
    const ab = a + (b - a) * u;
    const cd = c + (d - c) * u;
    return ab + (cd - ab) * v;
  };
  return (x: number, y: number, octaves: number, persistence: number) => {
    let freq = 1;
    let amp = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise(x * freq, y * freq) * amp;
      norm += amp;
      freq *= 2;
      amp *= persistence;
    }
    return sum / norm;
  };
}

/** 高程 -> 地貌色带：深海到雪线分段线性插值 */
function ramp(v: number, sea: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0, [22, 42, 82]],
    [sea, [64, 118, 172]],
    [sea + 0.03, [216, 202, 150]],
    [sea + 0.14, [98, 152, 90]],
    [sea + 0.32, [54, 104, 66]],
    [sea + 0.48, [126, 121, 118]],
    [1, [241, 243, 247]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const t = (v - t0) / (t1 - t0 || 1);
      return [
        c0[0] + (c1[0] - c0[0]) * t,
        c0[1] + (c1[1] - c0[1]) * t,
        c0[2] + (c1[2] - c0[2]) * t,
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/** 地图生成：分形值噪声 + 海平面切割地貌色带，参数即时重绘 */
export function SimMap({ scheme }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [octaves, setOctaves] = useState(5);
  const [persistence, setPersistence] = useState(0.5);
  const [scale, setScale] = useState(4);
  const [sea, setSea] = useState(0.42);
  const [seed, setSeed] = useState(() => randomSeed());

  const redraw = () => {
    const canvas = canvasRef.current;
    const c = canvas ? fitCanvas(canvas) : null;
    if (!c) return;
    const { ctx, w, h } = c;
    // 半分辨率采样后拉伸：地形本就柔和，像素量降为 1/4
    const sw = Math.max(2, Math.round(w / 2));
    const sh = Math.max(2, Math.round(h / 2));
    const off = document.createElement('canvas');
    off.width = sw;
    off.height = sh;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    const fbm = makeTerrain(seed);
    const img = offCtx.createImageData(sw, sh);
    let land = 0;
    let vmax = 0;
    for (let j = 0; j < sh; j++) {
      for (let i = 0; i < sw; i++) {
        const v = fbm((i / sw) * scale, (j / sh) * scale, octaves, persistence);
        const [r, g, b] = ramp(v, sea);
        const k = (j * sw + i) * 4;
        img.data[k] = r;
        img.data[k + 1] = g;
        img.data[k + 2] = b;
        img.data[k + 3] = 255;
        if (v > sea) land++;
        if (v > vmax) vmax = v;
      }
    }
    statSet('sim-map', 'land', Math.round((land / (sw * sh)) * 100));
    statSet('sim-map', 'peakE', Math.round(vmax * 100));
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, h);
    drawHud(
      ctx,
      `${sw}×${sh} · seed ${seed}`,
      scheme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.5)',
    );
  };

  useEffect(redraw, [seed, octaves, persistence, scale, sea, scheme]);
  useResize(canvasRef, redraw);
  // 生成次数：参数或种子变化计一次（窗口缩放重绘不计）
  useEffect(() => {
    statAdd('sim-map', 'gens');
  }, [seed, octaves, persistence, scale, sea]);

  return (
    <>
      <div className={s.frame}>
        <canvas ref={canvasRef} className={s.canvas} />
      </div>
      <div style={{ height: 8 }} />
      <Group gap="sm" wrap="wrap" className={s.controls}>
        <DiceButton onClick={() => setSeed(randomSeed())} label="换一张地图" />
        <ParamSlider label="倍频数" value={octaves} min={1} max={8} onChange={setOctaves} />
        <ParamSlider
          label="持续度"
          value={persistence}
          min={0.25}
          max={0.7}
          step={0.01}
          onChange={setPersistence}
          format={(v) => v.toFixed(2)}
        />
        <ParamSlider label="地形缩放" value={scale} min={2} max={8} step={0.5} onChange={setScale} />
        <ParamSlider
          label="海平面"
          value={sea}
          min={0.15}
          max={0.7}
          step={0.01}
          onChange={setSea}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      </Group>
      <SimStats
        sim="sim-map"
        items={[
          { key: 'gens', label: '生成次数' },
          { key: 'land', label: '陆地占比', format: (v) => `${v}%` },
          { key: 'peakE', label: '峰值海拔', format: (v) => `${v}%` },
        ]}
      />
    </>
  );
}

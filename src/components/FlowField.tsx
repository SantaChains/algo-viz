import { useEffect, useRef, useState } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconDice5, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import styles from "./FlowField.module.scss";

interface Props {
  scheme: "light" | "dark";
}

/** mulberry32：种子化 PRNG，同种子同序列 */
function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 种子化 2D Perlin 噪声：置换表由 PRNG 洗牌，输出 [-1, 1] */
function makeNoise(rand: () => number) {
  const p = new Uint8Array(512);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  const grad = (h: number, x: number, y: number) => {
    switch (h & 3) {
      case 0:
        return x + y;
      case 1:
        return x - y;
      case 2:
        return -x + y;
      default:
        return -x - y;
    }
  };
  return (x: number, y: number) => {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const X = fx & 255;
    const Y = fy & 255;
    const xf = x - fx;
    const yf = y - fy;
    const u = fade(xf);
    const v = fade(yf);
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v,
    );
  };
}

type Particle = { x: number; y: number; life: number; color: string };

/** 种子化流场：噪声场决定粒子流向，半透明叠加成拖尾，种子可复现场纹理；暂停时沉淀为完整流线静帧 */
export function FlowField({ scheme }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = useState(() => 1000 + Math.floor(Math.random() * 9000));
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rand = mulberry32(seed);
    const noise = makeNoise(rand);
    const css = getComputedStyle(document.documentElement);
    const pick = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const base = pick(
      scheme === "dark" ? "--mantine-color-violet-4" : "--mantine-color-violet-6",
      scheme === "dark" ? "#9775fa" : "#7950f2",
    );
    const accent = pick(
      scheme === "dark" ? "--mantine-color-violet-2" : "--mantine-color-violet-9",
      scheme === "dark" ? "#baa7fa" : "#4c2e9e",
    );

    let w = 0;
    let h = 0;
    let parts: Particle[] = [];

    const spawn = (p: Particle) => {
      p.x = rand() * w;
      p.y = rand() * h;
      p.life = 50 + rand() * 120;
      p.color = rand() < 0.16 ? accent : base;
    };

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const n = Math.round(Math.min(260, Math.max(80, (w * h) / 7000)));
      parts = Array.from({ length: n }, () => {
        const p = {} as Particle;
        spawn(p);
        return p;
      });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
    };

    // 单个粒子推进一步并画线段，越界或寿命尽则重生
    const advance = (p: Particle, alpha: number) => {
      const a = noise(p.x * 0.0016, p.y * 0.0016) * Math.PI * 3;
      const nx = p.x + Math.cos(a) * 2.2;
      const ny = p.y + Math.sin(a) * 2.2;
      if (--p.life > 0 && nx > 0 && nx < w && ny > 0 && ny < h) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        p.x = nx;
        p.y = ny;
      } else {
        spawn(p);
      }
    };

    // 帧步进：destination-out 透明擦除形成拖尾，底层网格与光晕始终可见；
    // 暗色用 lighter 叠加产生发光感
    const step = () => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = scheme === "dark" ? "lighter" : "source-over";
      ctx.lineWidth = 1.4;
      for (const p of parts) advance(p, 0.65);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    // 静帧降级：不擦除长积累，沉淀成完整流线纹理
    const renderStatic = () => {
      ctx.globalCompositeOperation = scheme === "dark" ? "lighter" : "source-over";
      ctx.lineWidth = 1.1;
      const steps = Math.round((w * h) / 1000);
      for (let i = 0; i < steps; i++) for (const p of parts) advance(p, 0.2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    let raf = 0;
    let running = false;
    const loop = () => {
      step();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    // 暂停时一次性长积累成完整流线纹理；否则持续动画
    if (paused) renderStatic();
    else start();

    const onVis = () => {
      if (document.hidden) stop();
      else if (!paused) start();
    };
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        if (paused) renderStatic();
      }, 150);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", onResize);

    // 离屏暂停：hero 滚出视口即停 rAF，回视口恢复，避免不可见时空转烧 CPU
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!paused && !document.hidden) start();
        } else {
          stop();
        }
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    return () => {
      stop();
      io.disconnect();
      window.clearTimeout(resizeTimer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
    };
  }, [scheme, seed, paused]);

  return (
    <div className={styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div className={styles.ctrl}>
        <span className={styles.seedLabel}>seed {seed}</span>
        <Tooltip label={paused ? "播放流场动画" : "暂停流场动画"}>
          <ActionIcon
            variant="default"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "播放" : "暂停"}
          >
            {paused ? <IconPlayerPlay size={14} /> : <IconPlayerPause size={14} />}
          </ActionIcon>
        </Tooltip>
        <Tooltip label="换一颗种子，重绘流场">
          <ActionIcon
            variant="default"
            size="sm"
            onClick={() => setSeed(1000 + Math.floor(Math.random() * 9000))}
            aria-label="更换种子"
          >
            <IconDice5 size={14} />
          </ActionIcon>
        </Tooltip>
      </div>
    </div>
  );
}

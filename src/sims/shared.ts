import { useEffect, useRef, type RefObject } from 'react';

export interface SimProps {
  scheme: 'light' | 'dark';
}

/** canvas 内无法读 CSS 变量，按色模式取一套主题色 */
export function simColors(scheme: 'light' | 'dark') {
  const dark = scheme === 'dark';
  return {
    bg: dark ? '#131318' : '#fafafa',
    grid: dark ? '#232329' : '#ececf1',
    wall: dark ? '#3f3f4a' : '#b9b9c6',
    accent: dark ? '#9775fa' : '#7950f2',
    info: dark ? '#74c0fc' : '#1c7ed6',
    good: dark ? '#69db7c' : '#2f9e44',
    bad: dark ? '#ff8787' : '#e03131',
    warn: dark ? '#ffd43b' : '#f08c00',
    dim: dark ? '#8e8e9e' : '#71717d',
    text: dark ? '#e6e6ea' : '#1a1a1f',
  };
}

const MONO = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** DPR 适配：跟随 CSS 尺寸设置像素尺寸，返回 2D 上下文（不可用或零尺寸返回 null） */
export function fitCanvas(canvas: HTMLCanvasElement) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/**
 * rAF 循环：running 切换自动启停；ResizeObserver 保证暂停与尺寸变化时也重绘当前帧（dt=0）。
 * draw 每帧取最新闭包，参数改动即时生效。
 */
export function useSimLoop(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  running: boolean,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, dt: number) => void,
) {
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      const c = fitCanvas(canvas);
      if (c) drawRef.current(c.ctx, c.w, c.h, dt);
      raf = requestAnimationFrame(frame);
    };
    const ro = new ResizeObserver(() => {
      const c = fitCanvas(canvas);
      if (c) drawRef.current(c.ctx, c.w, c.h, 0);
    });
    ro.observe(canvas);
    if (running) raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [canvasRef, running]);
}

/** 尺寸观察：元素尺寸变化时触发回调（静态画布的重绘入口） */
export function useResize(canvasRef: RefObject<HTMLCanvasElement | null>, cb: () => void) {
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => cbRef.current());
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasRef]);
}

/** 左上角 HUD：canvas 内绘制，避免高频 setState */
export function drawHud(ctx: CanvasRenderingContext2D, text: string, dim: string) {
  ctx.font = MONO;
  ctx.fillStyle = dim;
  ctx.fillText(text, 10, 18);
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---- 会话统计：模块级 store，切页保留、刷新页面即清零 ----
// 与 viz 引擎同范式：version + useSyncExternalStore 订阅，替代 SimStats 的定时轮询
const statStore = new Map<string, Map<string, number>>();
let statVersion = 0;
const statListeners = new Set<() => void>();
let statScheduled = false;

/** 通知订阅者。同一帧内多次 statAdd 合并为一次微任务通知，避免每命令都触发重渲染 */
function emitStat() {
  statVersion++;
  if (statScheduled) return;
  statScheduled = true;
  queueMicrotask(() => {
    statScheduled = false;
    for (const l of statListeners) l();
  });
}

export const subscribeStats = (listener: () => void) => {
  statListeners.add(listener);
  return () => {
    statListeners.delete(listener);
  };
};

export const getStatVersion = () => statVersion;

function statMap(sim: string) {
  let m = statStore.get(sim);
  if (!m) statStore.set(sim, (m = new Map()));
  return m;
}

export const statGet = (sim: string, key: string) => statStore.get(sim)?.get(key) ?? 0;

export function statAdd(sim: string, key: string, delta = 1) {
  const m = statMap(sim);
  m.set(key, (m.get(key) ?? 0) + delta);
  emitStat();
}

export function statSet(sim: string, key: string, v: number) {
  statMap(sim).set(key, v);
  emitStat();
}

export function statMax(sim: string, key: string, v: number) {
  if (v > statGet(sim, key)) {
    statMap(sim).set(key, v);
    emitStat();
  }
}

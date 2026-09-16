import type { Chunk, Command, Renderable } from './types';
import { tracerClasses } from './tracers';
import { layoutClasses } from './layouts';

export type Speed = number;

export interface VizStats {
  /** 总步数（delay 分帧数） */
  steps: number;
  /** 关键操作总数 */
  ops: number;
  /** 按方法计数的操作明细 */
  byMethod: Record<string, number>;
}

/** 计入学习统计的操作方法（构造/set/delay 等结构性命令不计） */
const STAT_METHODS = new Set(['select', 'patch', 'visit', 'leave']);

/**
 * 可视化引擎：命令流 -> 分帧 -> 时间轴重放。
 * 单例 store，Player 与 Viewer 通过 useSyncExternalStore 订阅。
 */
class VisualizationEngine {
  chunks: Chunk[] = [];
  cursor = 0;
  playing = false;
  speed: Speed = 2;
  stats: VizStats = { steps: 0, ops: 0, byMethod: {} };
  root: Renderable | null = null;
  objects = new Map<string, Renderable>();

  private version = 0;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  private notify() {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  getObject = (key: string) => this.objects.get(key);

  /** 将命令流按 delay 切帧并重置到初始状态，随后自动前进一步 */
  run(commands: Command[]) {
    const chunks: Chunk[] = [{ commands: [] }];
    for (const command of commands) {
      if (command.key === null && command.method === 'delay') {
        chunks[chunks.length - 1].lineNumber = command.args[0] as number | undefined;
        chunks.push({ commands: [] });
      } else {
        chunks[chunks.length - 1].commands.push(command);
      }
    }
    this.chunks = chunks;
    this.stats = this.measureStats(chunks);
    this.pause();
    this.resetReplay();
    this.notify();
    this.next();
  }

  /** 一次性统计整条命令流：步数 + 关键操作计数 */
  private measureStats(chunks: Chunk[]): VizStats {
    const byMethod: Record<string, number> = {};
    let ops = 0;
    for (const chunk of chunks) {
      for (const command of chunk.commands) {
        if (!STAT_METHODS.has(command.method)) continue;
        byMethod[command.method] = (byMethod[command.method] ?? 0) + 1;
        ops++;
      }
    }
    return { steps: chunks.length - 1, ops, byMethod };
  }

  private resetReplay() {
    this.objects = new Map();
    this.root = null;
    this.cursor = 0;
    this.applyChunks(this.chunks.slice(0, 0));
  }

  private applyChunks(chunks: Chunk[]) {
    for (const chunk of chunks) {
      for (const command of chunk.commands) this.applyCommand(command);
    }
  }

  private applyCommand(command: Command) {
    const { key, method, args } = command;
    const TracerClass = tracerClasses[method];
    const LayoutClass = layoutClasses[method];
    if (key === null && method === 'setRoot') {
      this.root = this.objects.get(args[0] as string) ?? null;
    } else if (method === 'destroy') {
      this.objects.delete(key!);
    } else if (TracerClass) {
      this.objects.set(key!, new TracerClass(key!, args[0] as string | undefined));
    } else if (LayoutClass) {
      this.objects.set(key!, new LayoutClass(key!, args[0] as string[]));
    } else {
      const target = this.objects.get(key!) as { exec: (method: string, args: unknown[]) => void } | undefined;
      target?.exec(method, args);
    }
  }

  isValidCursor(cursor: number) {
    return 1 <= cursor && cursor <= this.chunks.length;
  }

  /** 播放循环专用：前进一步但不改 playing 状态；到末尾返回 false */
  advance() {
    const cursor = this.cursor + 1;
    if (!this.isValidCursor(cursor)) return false;
    this.cursor = cursor;
    this.applyChunks(this.chunks.slice(this.cursor - 1, this.cursor));
    this.notify();
    return true;
  }

  /** 手动步进 = 暂停 + 前进 */
  next() {
    this.pause();
    return this.advance();
  }

  prev() {
    this.pause();
    const cursor = this.cursor - 1;
    if (!this.isValidCursor(cursor)) return false;
    this.seek(cursor);
    return true;
  }

  resume(wrap = false) {
    this.pause();
    if (
      this.advance() ||
      (wrap && ((this.cursor = 1), this.applyChunks(this.chunks.slice(0, 1)), this.notify(), true))
    ) {
      this.playing = true;
      this.notify();
      return true;
    }
    return false;
  }

  pause() {
    if (this.playing) {
      this.playing = false;
      this.notify();
    }
  }

  seek(cursor: number) {
    this.pause();
    cursor = Math.max(1, Math.min(this.chunks.length, Math.round(cursor)));
    if (cursor >= this.cursor) {
      this.applyChunks(this.chunks.slice(this.cursor, cursor));
    } else {
      this.resetReplay();
      this.applyChunks(this.chunks.slice(0, cursor));
    }
    this.cursor = cursor;
    this.notify();
  }

  setSpeed(speed: Speed) {
    this.speed = speed;
    this.notify();
  }

  /** 播放节奏与原版一致：interval = 4000 / e^speed */
  get interval() {
    return 4000 / Math.exp(this.speed);
  }
}

export const viz = new VisualizationEngine();

// ---- 录制上下文：算法代码在 record() 内执行，Tracer 方法调用被序列化为命令 ----

let recording: Command[] | null = null;

export function record(run: () => void): Command[] {
  const buffer: Command[] = [];
  recording = buffer;
  try {
    run();
  } finally {
    recording = null;
  }
  return buffer;
}

export function pushCommand(key: string | null, method: string, args: unknown[]) {
  if (recording) recording.push({ key, method, args });
}

/** 算法代码中的分帧点：下一次渲染到当前状态 */
export function delay(lineNumber?: number) {
  pushCommand(null, 'delay', lineNumber !== undefined ? [lineNumber] : []);
}

/** 设置可视化布局根 */
export function setRoot(key: string) {
  pushCommand(null, 'setRoot', [key]);
}

import type { ReactNode } from 'react';

/** 从 key 解析到可视化对象（tracer 或 layout） */
export type RenderResolve = (key: string) => Renderable | undefined;

/** 可渲染对象：tracer 与 layout 的统一接口 */
export interface Renderable {
  render(resolve: RenderResolve): ReactNode;
}

export interface Command {
  /** tracer/layout 的 key；key 为 null 时是全局命令（delay、setRoot） */
  key: string | null;
  /** tracer 构造命令的 method 是类名（如 'Array1DTracer'），其余为 tracer 方法名 */
  method: string;
  args: unknown[];
}

export interface Chunk {
  commands: Command[];
  lineNumber?: number;
}

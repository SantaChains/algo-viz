import type { ReactNode } from 'react';
import type { Renderable, RenderResolve } from '../types';
import { pushCommand } from '../engine';
import styles from './layouts.module.scss';

/**
 * 布局：组合多个 tracer/子布局的容器。
 * 录制：new HorizontalLayout(key, childKeys) 序列化为构造命令。
 * 渲染：按声明方向 flex 排布子对象。
 */
export abstract class Layout implements Renderable {
  readonly key: string;
  readonly childKeys: string[];

  constructor(key: string, childKeys: string[]) {
    this.key = key;
    this.childKeys = childKeys;
    // 构造本身也是一条命令，重放时由引擎按类名实例化
    pushCommand(key, this.commandName(), [childKeys]);
  }

  abstract commandName(): string;

  abstract get direction(): 'row' | 'column';

  render(resolve: RenderResolve): ReactNode {
    return (
      <div
        key={this.key}
        className={styles.layout}
        style={{ flexDirection: this.direction }}
      >
        {this.childKeys.map((childKey) => {
          const child = resolve(childKey);
          return child ? child.render(resolve) : null;
        })}
      </div>
    );
  }
}

export class HorizontalLayout extends Layout {
  commandName() {
    return 'HorizontalLayout';
  }

  get direction() {
    return 'row' as const;
  }
}

export class VerticalLayout extends Layout {
  commandName() {
    return 'VerticalLayout';
  }

  get direction() {
    return 'column' as const;
  }
}

/** 重放与录制共用：构造命令 method -> 类（构造契约：(key, childKeys)） */
export const layoutClasses: Record<string, typeof HorizontalLayout | typeof VerticalLayout> = {
  HorizontalLayout,
  VerticalLayout,
};

import { describe, expect, test } from "bun:test";
import { viz } from "../src/core/engine";
import type { Command } from "../src/core/types";

interface Cell {
  value: unknown;
  patched: boolean;
  selected: boolean;
}
const arrData = () => (viz.getObject("a") as unknown as { data: Cell[] }).data;

// 3 个 delay → 4 帧；含 1 次 select + 1 次 patch（白名单统计方法）
const cmds: Command[] = [
  { key: "a", method: "Array1DTracer", args: ["数组"] },
  { key: "a", method: "set", args: [[3, 1, 2]] },
  { key: null, method: "delay", args: [10] },
  { key: "a", method: "select", args: [0, 1] },
  { key: null, method: "delay", args: [11] },
  { key: "a", method: "patch", args: [0, 9] },
  { key: null, method: "delay", args: [12] },
];

describe("VisualizationEngine 分帧与统计", () => {
  test("按 delay 切帧：chunks = delay 数 + 1，各帧记录行号", () => {
    viz.run(cmds);
    expect(viz.chunks).toHaveLength(4);
    expect(viz.chunks[0].lineNumber).toBe(10);
    expect(viz.chunks[1].lineNumber).toBe(11);
    expect(viz.chunks[2].lineNumber).toBe(12);
  });

  test("run 后自动前进到第 1 帧", () => {
    viz.run(cmds);
    expect(viz.cursor).toBe(1);
  });

  test("统计仅计白名单 select/patch/visit/leave，构造与 set 不计", () => {
    viz.run(cmds);
    expect(viz.stats.steps).toBe(3);
    expect(viz.stats.ops).toBe(2);
    expect(viz.stats.byMethod.select).toBe(1);
    expect(viz.stats.byMethod.patch).toBe(1);
  });
});

describe("VisualizationEngine seek 重放前缀", () => {
  test("seek 到末帧应用全部命令，tracer 状态正确", () => {
    viz.run(cmds);
    viz.seek(viz.chunks.length);
    expect(viz.cursor).toBe(4);
    expect(arrData()[0]).toEqual({ value: 9, patched: true, selected: true });
    expect(arrData()[1].selected).toBe(true);
    expect(arrData()[2].selected).toBe(false);
  });

  test("回退到首帧丢弃后续 select/patch", () => {
    viz.run(cmds);
    viz.seek(4);
    viz.seek(1);
    expect(viz.cursor).toBe(1);
    expect(arrData()[0]).toEqual({ value: 3, patched: false, selected: false });
  });

  test("越界 seek 被夹取到合法区间", () => {
    viz.run(cmds);
    viz.seek(999);
    expect(viz.cursor).toBe(4);
    viz.seek(-5);
    expect(viz.cursor).toBe(1);
  });

  test("首帧 prev 返回 false 且不动，末帧 next 返回 false", () => {
    viz.run(cmds);
    viz.seek(1);
    expect(viz.prev()).toBe(false);
    expect(viz.cursor).toBe(1);
    viz.seek(4);
    expect(viz.next()).toBe(false);
    expect(viz.cursor).toBe(4);
  });
});

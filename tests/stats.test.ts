import { describe, expect, test } from "bun:test";
import {
  getStatVersion,
  statAdd,
  statGet,
  statMax,
  statSet,
  subscribeStats,
} from "../src/sims/shared";

describe("statStore", () => {
  test("statGet 未写入时返回 0", () => {
    expect(statGet("nope", "missing")).toBe(0);
  });

  test("statAdd 累加，支持自定义步长与负增量", () => {
    statAdd("acc", "kills");
    statAdd("acc", "kills");
    expect(statGet("acc", "kills")).toBe(2);
    statAdd("acc", "kills", 5);
    expect(statGet("acc", "kills")).toBe(7);
    statAdd("acc", "kills", -3);
    expect(statGet("acc", "kills")).toBe(4);
  });

  test("statSet 直接覆盖，不同 sim 互不干扰", () => {
    statSet("s1", "score", 100);
    statSet("s2", "score", 7);
    expect(statGet("s1", "score")).toBe(100);
    expect(statGet("s2", "score")).toBe(7);
  });

  test("statMax 仅在更大时写入", () => {
    statSet("peak", "best", 10);
    statMax("peak", "best", 5);
    expect(statGet("peak", "best")).toBe(10);
    statMax("peak", "best", 20);
    expect(statGet("peak", "best")).toBe(20);
    statMax("peak", "best", 15);
    expect(statGet("peak", "best")).toBe(20);
  });

  test("每次有效变更递增 version，statMax 未命中不递增", () => {
    const v0 = getStatVersion();
    statAdd("ver", "a");
    expect(getStatVersion()).toBe(v0 + 1);
    statSet("ver", "a", 9);
    expect(getStatVersion()).toBe(v0 + 2);
    statMax("ver", "a", 1); // 9 > 1，不写入
    expect(getStatVersion()).toBe(v0 + 2);
    statMax("ver", "a", 99);
    expect(getStatVersion()).toBe(v0 + 3);
  });

  test("订阅者收到通知，退订后不再收到", async () => {
    let calls = 0;
    const unsub = subscribeStats(() => {
      calls++;
    });
    statAdd("sub", "x");
    await Promise.resolve();
    expect(calls).toBe(1);
    unsub();
    statAdd("sub", "x");
    await Promise.resolve();
    expect(calls).toBe(1);
  });

  test("同帧多次变更合并为一次微任务通知", async () => {
    let calls = 0;
    const unsub = subscribeStats(() => {
      calls++;
    });
    // 同步阶段：version 逐次递增，但通知尚未派发
    statAdd("batch", "x");
    statAdd("batch", "x");
    statAdd("batch", "x");
    expect(calls).toBe(0);
    await Promise.resolve();
    // 合并为一次通知，且反映最终值
    expect(calls).toBe(1);
    expect(statGet("batch", "x")).toBe(3);
    unsub();
  });
});

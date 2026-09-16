import { describe, expect, test } from "bun:test";
import { mulberry32, randomSeed } from "../src/core/random";

describe("mulberry32 种子化 PRNG", () => {
  test("同种子产生同序列（可复现性基石）", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, a);
    const seqB = Array.from({ length: 20 }, b);
    expect(seqA).toEqual(seqB);
  });

  test("不同种子产生不同序列", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(Array.from({ length: 8 }, a)).not.toEqual(Array.from({ length: 8 }, b));
  });

  test("输出恒在 [0,1) 区间", () => {
    const rand = mulberry32(0x9e37);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("randomSeed", () => {
  test("返回 32 位无符号范围内的整数", () => {
    for (let i = 0; i < 100; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

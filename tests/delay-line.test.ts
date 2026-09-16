import { describe, expect, test } from "bun:test";
import { delayLine } from "../plugins/delay-line";

/** 取出 transform 钩子直接调用（绕过 vite 插件 this 上下文，纯函数测试） */
function transform(
  code: string,
  id = "src/algorithms/x.ts",
): { code: string; map: unknown } | undefined {
  const t = delayLine().transform as unknown as (
    code: string,
    id: string,
  ) => { code: string; map: unknown } | undefined;
  return t(code, id);
}

describe("delay-line 插件：裸 delay() 注入行号", () => {
  test("单个 delay() 注入所在行号", () => {
    const out = transform("const a = 1;\ndelay()\nconst b = 2;\n");
    expect(out?.code).toContain("delay(2)");
  });

  test("多个 delay() 各自注入行号", () => {
    const out = transform("delay()\nfoo()\ndelay()\n");
    expect(out?.code).toBe("delay(1)\nfoo()\ndelay(3)\n");
  });
});

describe("delay-line 插件：跳过字符串与注释", () => {
  test("字符串内 delay() 不改写，同文件真 delay() 照改", () => {
    const out = transform('const s = "delay()";\ndelay()\n');
    expect(out?.code).toContain('"delay()"');
    expect(out?.code).toContain("delay(2)");
  });

  test("行注释内 delay() 不改写", () => {
    const out = transform("// delay()\ndelay()\n");
    expect(out?.code).toContain("// delay()");
    expect(out?.code).toContain("delay(2)");
  });

  test("块注释内 delay() 不改写", () => {
    const out = transform("/* delay() */\ndelay()\n");
    expect(out?.code).toContain("/* delay() */");
    expect(out?.code).toContain("delay(2)");
  });
});

describe("delay-line 插件：不误伤边界情形", () => {
  test("已带参数的 delay(x) 不改写", () => {
    expect(transform("delay(5)\n")).toBeUndefined();
  });

  test("标识符后缀 mydelay() 不改写", () => {
    expect(transform("mydelay()\n")).toBeUndefined();
  });

  test("非 algorithms 路径不改写", () => {
    expect(transform("delay()\n", "src/core/engine.ts")).toBeUndefined();
  });

  test("?raw 导入不改写", () => {
    expect(transform("delay()\n", "src/algorithms/x.ts?raw")).toBeUndefined();
  });

  test("无 delay() 时返回 undefined（不产生 sourcemap 开销）", () => {
    expect(transform("const a = 1;\n")).toBeUndefined();
  });
});

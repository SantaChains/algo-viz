import { describe, expect, test } from 'bun:test';
import { Array2DTracer } from '../src/core/tracers';

/**
 * 回归：编辑距离等算法全程只 patch 不 set，
 * 旧实现 _cell 只建行不建格导致 patch 静默 no-op、DP 表永远空白。
 */
describe('Array2DTracer 惰性建格', () => {
  test('无 set 时 patch 自建行列', () => {
    const t = new Array2DTracer('dp', 'dp');
    t._patch(0, 0, 0);
    t._patch(2, 3, 7);
    expect(t.data.length).toBe(3);
    expect(t.data[0][0]?.value).toBe(0);
    expect(t.data[2][3]?.value).toBe(7);
    expect(t.data[2].length).toBe(4);
  });

  test('select/deselect 不创建格，只高亮已存在格', () => {
    const t = new Array2DTracer('dp', 'dp');
    t._select(1, 1);
    expect(t.data.length).toBe(0);
    t._patch(1, 1, 5);
    t._select(1, 1);
    expect(t.data[1][1]?.selected).toBe(true);
    t._deselect(1, 1);
    expect(t.data[1][1]?.selected).toBe(false);
  });

  test('set 后 patch 覆盖值并标记，depatch 清除标记', () => {
    const t = new Array2DTracer('dp', 'dp');
    t._set([
      [1, 2],
      [3, 4],
    ]);
    t._patch(1, 0, 9);
    expect(t.data[1][0]).toEqual({ value: 9, patched: true, selected: false });
    t._depatch(1, 0);
    expect(t.data[1][0]?.patched).toBe(false);
  });
});

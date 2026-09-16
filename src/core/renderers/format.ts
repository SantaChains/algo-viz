/** 数值展示格式化：溢出值转 ∞，小数截断，与原版行为一致 */
export function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    if ([Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER, 0x7fffffff].includes(value)) return '∞';
    if ([Number.NEGATIVE_INFINITY, Number.MIN_SAFE_INTEGER, -0x80000000].includes(value)) return '-∞';
    return Number.isInteger(value) ? value.toString() : value.toFixed(3);
  }
  if (typeof value === 'boolean') return value ? 'T' : 'F';
  return String(value ?? '');
}

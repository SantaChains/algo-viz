import type { DemoConfig } from './algorithms';

/** 实验室路由参数：分类 / demo / 配置快照（cfg 编码进 hash） */
export interface LabRoute {
  category?: string;
  demoId?: string;
  cfg?: DemoConfig;
}

export type View = { page: 'home' } | { page: 'lab'; route: LabRoute };

/** 解析 location.hash 为视图；非法片段宽松放行，白名单校验在 Shell 内做 */
export function parseHash(): View {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw.startsWith('/lab')) return { page: 'home' };
  const [path, query = ''] = raw.split('?');
  const segs = path.split('/').filter(Boolean);
  let cfg: DemoConfig | undefined;
  const cfgParam = new URLSearchParams(query).get('cfg');
  if (cfgParam) {
    try {
      cfg = JSON.parse(cfgParam) as DemoConfig;
    } catch {
      // 损坏的快照参数按无配置处理
    }
  }
  return { page: 'lab', route: { category: segs[1], demoId: segs[2], cfg } };
}

/** 构造实验室 hash：#/lab/{category}/{demoId}?cfg=<json> */
export function labHash(category?: string, demoId?: string, cfg?: DemoConfig): string {
  let hash = '#/lab';
  if (category) hash += `/${category}`;
  if (category && demoId) hash += `/${demoId}`;
  if (cfg) hash += `?cfg=${encodeURIComponent(JSON.stringify(cfg))}`;
  return hash;
}

// ---- hash 写入统一收敛在此模块（组件内直接改 window.location 会被 react-immutability 规则拦截） ----

/** 着陆页 -> 实验室（点击类导航，产生历史记录） */
export function navigateLab(category?: string) {
  window.location.hash = category ? `#/lab/${category}` : '#/lab';
}

/** 实验室 -> 着陆页 */
export function navigateHome() {
  window.location.hash = '#/';
}

/** 实验室内部导航：切分类/切 demo（产生历史记录） */
export function navigateTo(category?: string, demoId?: string) {
  window.location.hash = labHash(category, demoId);
}

/** 参数回写：replaceState 不产生历史记录 */
export function replaceHash(category?: string, demoId?: string, cfg?: DemoConfig) {
  history.replaceState(null, '', labHash(category, demoId, cfg));
}

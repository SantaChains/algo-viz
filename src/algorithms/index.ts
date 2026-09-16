import type {
  AlgorithmDemo,
  DemoConfig,
  DpConfig,
  GraphConfig,
  GreedyConfig,
  SortConfig,
  StringConfig,
} from './types';
import { bubbleSortCommands } from './bubble-sort';
import { quickSortCommands } from './quick-sort';
import { binarySearchCommands } from './binary-search';
import { graphDfsCommands } from './graph-dfs';
import { graphBfsCommands } from './graph-bfs';
import { graphDijkstraCommands } from './graph-dijkstra';
import { graphAstarCommands } from './graph-astar';
import { kmpCommands } from './kmp';
import { lisCommands } from './lis';
import { editDistanceCommands } from './edit-distance';
import { intervalSchedulingCommands } from './interval-scheduling';
import bubbleSortSource from './bubble-sort.ts?raw';
import quickSortSource from './quick-sort.ts?raw';
import binarySearchSource from './binary-search.ts?raw';
import graphDfsSource from './graph-dfs.ts?raw';
import graphBfsSource from './graph-bfs.ts?raw';
import graphDijkstraSource from './graph-dijkstra.ts?raw';
import graphAstarSource from './graph-astar.ts?raw';
import kmpSource from './kmp.ts?raw';
import lisSource from './lis.ts?raw';
import editDistanceSource from './edit-distance.ts?raw';
import intervalSchedulingSource from './interval-scheduling.ts?raw';

export type {
  AlgorithmDemo,
  DemoConfig,
  DpConfig,
  GraphConfig,
  GreedyConfig,
  SortConfig,
  StringConfig,
} from './types';

/** 分类 key -> 算法 demo 列表，与 Shell 的 categories 对应 */
export const demos: Record<string, AlgorithmDemo[]> = {
  sorting: [
    {
      id: 'bubble-sort',
      kind: 'sort',
      title: '冒泡排序',
      description: '相邻元素两两比较、逆序交换，每一轮把最大值冒泡到末尾',
      complexity: 'O(n²) 时间 · O(1) 空间',
      notes: '不变式：第 i 轮结束后，末尾 i 个元素已就位且相对有序。一旦整轮无交换即提前终止，对近乎有序的输入退化为 O(n)。',
      annotations: {
        14: '数据由种子生成，同种子可复现',
        26: 'select 高亮相邻对，准备比较',
        27: 'delay() 即一帧：播放时源码会高亮到这一行',
        29: '逆序则交换——前 i 轮后末尾 i 个元素已就位',
        30: 'patch 标记本帧内发生变化的元素',
        39: '整轮无交换即提前终止，近乎有序输入退化为 O(n)',
      },
      statLabels: { select: '比较', patch: '写入' },
      defaultConfig: { size: 16, min: 5, max: 99, seed: 42, distribution: 'random' } satisfies SortConfig,
      commands: (cfg: DemoConfig) => bubbleSortCommands(cfg as SortConfig),
      source: bubbleSortSource,
    },
    {
      id: 'quick-sort',
      kind: 'sort',
      title: '快速排序',
      description: 'Lomuto 分区：以末尾为主轴划分左右区，主轴落位后分治递归',
      complexity: 'O(n log n) 平均 · O(log n) 栈空间',
      notes: '不变式：每一轮分区结束后，主轴左侧全部小于它、右侧全部不小于它，主轴的位置即最终位置。递归只发生在主轴两侧，区间长度 0 或 1 时天然有序。',
      annotations: {
        29: 'Lomuto 分区：取区间末尾元素为主轴',
        34: 'i 是「小于主轴」区的右边界，初始在区间外',
        37: 'select 高亮当前考察元素',
        38: '小于主轴则归入左区：与边界 i 处交换',
        47: '主轴与 i 交换落位——这个位置从此固定',
        54: '分治：主轴两侧递归，区间为空或单元素时终止',
      },
      statLabels: { select: '比较', patch: '写入' },
      defaultConfig: { size: 16, min: 5, max: 99, seed: 42, distribution: 'random' } satisfies SortConfig,
      commands: (cfg: DemoConfig) => quickSortCommands(cfg as SortConfig),
      source: quickSortSource,
    },
  ],
  search: [
    {
      id: 'binary-search',
      kind: 'search',
      title: '二分查找',
      description: '有序数组上取中点比较，每次比较排除一半区间',
      complexity: 'O(log n) 时间 · O(1) 空间',
      notes: '不变式：若目标存在，它始终位于 [lo, hi] 区间内。每次比较后区间严格减半，最多 log₂n + 1 次比较即终止。前提是数组有序。',
      annotations: {
        12: '数据先升序排序——有序是二分的前提',
        13: '目标值由种子派生，同种子同目标',
        27: '位运算取中点，等价于 (lo + hi) / 2',
        28: 'select 高亮当前搜索区间',
        35: 'a[mid] < target：左半全部排除，lo 右移',
        41: 'a[mid] > target：右半全部排除，hi 左移',
      },
      statLabels: { select: '比较' },
      defaultConfig: { size: 20, min: 5, max: 99, seed: 7, distribution: 'random' } satisfies SortConfig,
      commands: (cfg: DemoConfig) => binarySearchCommands(cfg as SortConfig),
      source: binarySearchSource,
    },
  ],
  graph: [
    {
      id: 'graph-dfs',
      kind: 'graph',
      title: '深度优先搜索 DFS',
      description: '从起点递归深入邻接点，visit 记到达、select 记考察中、leave 记回溯',
      complexity: 'O(V+E) 时间 · O(V) 空间',
      notes: '不变式：递归栈上的节点构成一条从起点出发的路径；节点只在首次 visit 时入栈，leave 时路径回退一格。访问顺序取决于邻接顺序。',
      annotations: {
        14: '邻接矩阵由种子生成：随机树骨架保证连通，再按密度补边',
        22: 'visited 集合防止环上的重复访问',
        28: 'visit 记到达：节点变蓝并沿边传播',
        33: 'select 记考察中的边（黄色）',
        38: 'leave 记回溯：所有邻居处理完才退栈',
      },
      statLabels: { visit: '访问', select: '考察', leave: '回溯' },
      defaultConfig: { nodes: 8, density: 0.5, seed: 42, directed: false } satisfies GraphConfig,
      commands: (cfg: DemoConfig) => graphDfsCommands(cfg as GraphConfig),
      source: graphDfsSource,
    },
    {
      id: 'graph-bfs',
      kind: 'graph',
      title: '广度优先搜索 BFS',
      description: '队列驱动逐层扩散，先访问距起点近的节点',
      complexity: 'O(V+E) 时间 · O(V) 空间',
      notes: '不变式：队列中的节点按到起点的距离非降序排列——先进先出保证了「距离近的先出队」。与 DFS 不同，BFS 天然给出最短跳数（无权图）。',
      annotations: {
        19: 'visited 与队列同步维护，入队即标记',
        21: '起点先访问、先入队',
        26: '队首出队，开始处理它的邻居',
        29: 'select 高亮发现边，visit 后入队',
        38: '出队时其距离层已全部被发现',
      },
      statLabels: { visit: '入队', select: '发现' },
      defaultConfig: { nodes: 8, density: 0.5, seed: 42, directed: false } satisfies GraphConfig,
      commands: (cfg: DemoConfig) => graphBfsCommands(cfg as GraphConfig),
      source: graphBfsSource,
    },
    {
      id: 'graph-dijkstra',
      kind: 'graph',
      title: 'Dijkstra 最短路',
      description: '贪心扩展：每轮定型 dist 最小的未定节点，再松弛其出边，dist 数组实时跟进',
      complexity: 'O(n²) 时间 · O(n) 空间',
      notes: '不变式：节点定型时其 dist 已是全局最短——前提是边权非负，定型顺序即 dist 非降序。visited 边汇成最短路树。负权边会破坏「定型即最优」，需改用 Bellman-Ford。',
      annotations: {
        15: '与 DFS/BFS 同种子同构，权重 = 1 + ⌊弦长/120⌋ 由几何确定',
        34: '每轮 O(n) 扫描，取未定节点中 dist 最小者',
        42: 'visit 定型：dist 从此不变，蓝边汇成最短路树',
        53: 'select 高亮考察中的边，dist 对应格同步高亮',
        57: '松弛更优则 patch 更新 dist，并记下父节点',
      },
      statLabels: { visit: '定型', select: '松弛' },
      defaultConfig: { nodes: 8, density: 0.5, seed: 42, directed: false } satisfies GraphConfig,
      commands: (cfg: DemoConfig) => graphDijkstraCommands(cfg as GraphConfig),
      source: graphDijkstraSource,
    },
    {
      id: 'graph-astar',
      kind: 'graph',
      title: 'A* 启发式搜索',
      description: '在 Dijkstra 框架上加启发式 h(v)，按 f = g + h 优先扩展离目标更近的节点',
      complexity: 'O(n²) 时间 · O(n) 空间',
      notes: 'h 取到目标的直线距离 ÷120 上取整；权重 1 + ⌊弦长/120⌋ 保证 w(e) ≥ 弦长/120，故 h 永不高估（可采纳），目标定型即最短路、可提前终止。与 Dijkstra 同图对比：扩展更少、方向性更强；h = 0 时退化为 Dijkstra。',
      annotations: {
        15: '与 Dijkstra 同种子同图，可直接对比扩展顺序',
        28: 'h(v)：到目标 7 的直线距离 ÷120 上取整，可采纳下界',
        44: '选点依据 f = g + h——与 Dijkstra 的唯一差异',
        48: '目标出队即提前终止：可采纳 h 保证此时已最优',
        85: '沿 parent 回溯还原最短路径',
      },
      statLabels: { visit: '定型', select: '松弛' },
      defaultConfig: { nodes: 8, density: 0.5, seed: 42, directed: false } satisfies GraphConfig,
      commands: (cfg: DemoConfig) => graphAstarCommands(cfg as GraphConfig),
      source: graphAstarSource,
    },
  ],
  string: [
    {
      id: 'kmp',
      kind: 'string',
      title: 'KMP 字符串匹配',
      description: 'fail 失配表预处理 + 线性扫描，主指针永不回退',
      complexity: 'O(n+m) 时间 · O(m) 空间',
      notes: '不变式：j 始终等于「p[0..j-1] 已与文本当前末尾对齐部分匹配」的长度。失配时按 fail[j-1] 回退 j，已匹配的前缀信息不丢失，i 从不回退——这是线性复杂度的来源。',
      annotations: {
        16: 'fail[i] = p[0..i] 最长相等前后缀的长度',
        30: 'k 是当前已匹配的前缀长度',
        32: '自匹配失配时同样按 fail 回退',
        39: 'select 覆盖 p[k..i]：整段验证前缀匹配',
        43: '匹配成功则前后缀延长，写入 fail 表',
        56: 'i 只前进——KMP 线性复杂度的来源',
        59: '失配时 j 按 fail 回退，不重头比较',
        71: 'j 到达 m：完整匹配，按 fail 继续找下一处',
      },
      statLabels: { select: '比较', patch: '写入' },
      defaultConfig: { textLen: 24, patLen: 5, seed: 42 } satisfies StringConfig,
      commands: (cfg: DemoConfig) => kmpCommands(cfg as StringConfig),
      source: kmpSource,
    },
  ],
  dp: [
    {
      id: 'lis',
      kind: 'dp',
      title: '最长上升子序列',
      description: 'O(n²) 递推：dp[i] = 以 a[i] 结尾的 LIS 长度，逐个向前的所有 j 尝试接续',
      complexity: 'O(n²) 时间 · O(n) 空间',
      notes: '不变式：任意时刻 dp[j]（j < i）已是「以 a[j] 结尾」的最优解，故转移只需枚举接在哪个 j 之后。最优子结构 + 无后效性是 dp 可行的前提；O(n log n) 解法把「接续点」换成二分维护。',
      annotations: {
        15: 'dp 先全部置 1：任何元素自身构成长度 1 的上升子序列',
        29: '行开始：dp[i] 先置 1（只含自身）',
        36: '每对 (j, i) 一帧：select 同时高亮源值与 dp 目标格',
        37: '转移条件：a[j] < a[i]（可接续）且 dp[j]+1 更优',
        39: 'patch 写入转移结果',
        47: '行结束 depatch，dp[i] 定型不再变化',
      },
      statLabels: { select: '比较', patch: '写入' },
      configLabels: { n: '序列长度', m: '值上限 1~m' },
      defaultConfig: { n: 12, m: 9, seed: 42 } satisfies DpConfig,
      commands: (cfg: DemoConfig) => lisCommands(cfg as DpConfig),
      source: lisSource,
    },
    {
      id: 'edit-distance',
      kind: 'dp',
      title: '编辑距离',
      description: 'dp[i][j] = A 前 i 个字符变成 B 前 j 个的最少操作，逐格填充二维表',
      complexity: 'O(nm) 时间 · O(nm) 空间',
      notes: '不变式：填充到 dp[i][j] 时，其依赖的左上/上/左三格均已定型。两字符相等则继承左上角且零代价；否则对「替换/删除/插入」三种来源取最小再加一。右下角即整串答案。',
      annotations: {
        17: '(n+1)×(m+1) 状态表，多出的行列表示空串',
        20: 'Array2DTracer：二维 dp 表格渲染',
        30: '第一列边界：dp[i][0]=i，从长度 i 删到空串',
        34: '第一行边界：dp[0][j]=j，从空串插到长度 j',
        45: '每格两帧：先比较字符，再写入结果',
        47: '相等：零代价继承左上角',
        50: '不等：1 + min(替换/删除/插入)',
        53: 'patch 写入当前格',
      },
      statLabels: { select: '比较', patch: '写入' },
      configLabels: { n: 'A 的长度', m: 'B 的长度' },
      defaultConfig: { n: 7, m: 6, seed: 42 } satisfies DpConfig,
      commands: (cfg: DemoConfig) => editDistanceCommands(cfg as DpConfig),
      source: editDistanceSource,
    },
  ],
  greedy: [
    {
      id: 'interval-scheduling',
      kind: 'greedy',
      title: '区间调度',
      description: '按结束时间排序后线性扫描，贪心选择结束最早且不冲突的区间',
      complexity: 'O(n log n) 时间 · O(1) 额外空间',
      notes: '不变式：扫描到第 i 个区间时，已选集合是前缀中「结束最早」且互不冲突的最优选择。交换论证：若最优解选了更晚结束的区间，换成当前区间不会更差。贪心的关键在排序依据——按结束时间而非开始时间或长度。',
      annotations: {
        14: '种子生成后按结束时间排序——贪心的排序依据',
        28: 'select 高亮当前考察的区间',
        31: '贪心判定：start 不早于已占用时刻 lastEnd 即兼容',
        34: 'patch 原值回写标记选中，lastEnd 推进到本区间结束',
        39: '每个区间两帧：考察一帧 + 决策一帧',
      },
      statLabels: { select: '考察', patch: '选中' },
      defaultConfig: { count: 10, seed: 42 } satisfies GreedyConfig,
      commands: (cfg: DemoConfig) => intervalSchedulingCommands(cfg as GreedyConfig),
      source: intervalSchedulingSource,
    },
  ],
};

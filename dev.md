# dev.md

架构与接口速查。技术栈选型规则见 docs/tech-stack.md。

## 数据流

```
算法代码 (algorithms/*.ts)
  │ 调用 Tracer API，每个方法调用序列化为 Command{key, method, args}
  │ delay() 由 delay-line 插件在构建期改写为 delay(行号)，即分帧点
  ▼
record() 返回 Command[]
  │ viz.run(commands)：按 delay 切帧 → Chunk[]，统计 VizStats，重置重放
  ▼
VisualizationEngine（单例 store）
  │ Player / SourcePanel / StatsBar 经 useVisualization() 订阅 version
  ▼
VisualizationViewer：root Layout.render() 递归渲染
  Tracer 重放状态（可变对象）由渲染器读取，React 只订阅引擎版本号
```

步进回退 = 重放前缀，无快照。seek(n) 重放 chunks[0..n)。

## 核心类型 (core/types.ts)

- `Command { key: string|null; method: string; args: unknown[] }` — key 为 null 是全局命令（delay、setRoot）
- `Chunk { commands: Command[]; lineNumber?: number }` — 一帧；lineNumber 来自 delay 参数
- `Renderable { render(resolve): ReactNode }` — tracer 与 layout 统一接口

## 引擎公开接口 (core/engine.ts)

`viz: VisualizationEngine` 单例：

- 状态：`chunks / cursor（1 起始）/ playing / speed / stats / root / objects`
- `run(commands)` 载入并切帧；`next() / prev() / seek(n) / resume(wrap) / pause()`
- `advance()`：播放循环专用步进，不改 playing；`next()` = 暂停 + 前进
- `get interval` 播放节奏 `4000 / e^speed`；`isValidCursor`
- `measureStats` 白名单统计 select/patch/visit/leave → `VizStats { steps, ops, byMethod }`

录制侧：`record(run)` 执行算法收集命令；`pushCommand`；`delay(lineNumber?)`；`setRoot(key)`。

## Tracer API (core/tracers/index.tsx)

基类约定：录制时构造即 push 构造命令（method = 类名）；重放时引擎按 `tracerClasses` 实例化，`exec(method, args)` 转发到 `_<method>` 实现。

- `Array1DTracer`：`set / patch(x,v) / depatch(x) / select(sx,ex?) / deselect` — select 支持区间高亮
- `Array2DTracer`：`set / patch(x,y,v) / depatch(x,y) / select(x,y) / deselect` — 按行 x 列 y 定位，dp 表格用
- `GraphTracer`：`set(matrix) / directed / weighted / layoutCircle / layoutTree / visit(t,src?) / leave / select / deselect`
- `LogTracer`：`set / print / println`

Layout（core/layouts）：`HorizontalLayout / VerticalLayout(key, childKeys)`，构造命令按 `layoutClasses` 重放。

## 渲染器 (core/renderers)

`RendererCard`（统一卡片外壳：标题 + 深浅色）包四种渲染器，纯读 tracer 重放后的可变状态、自身无状态；React 只经 `useVisualization()`（`useSyncExternalStore(viz.subscribe, viz.getVersion)`）订阅引擎版本号触发重绘。

- `Array1DRenderer`：一维条，按 patched/selected 上色（排序、查找、LIS、区间调度）
- `Array2DRenderer`：二维 dp 表格，行 x 列 y（编辑距离）
- `GraphRenderer`：SVG 图，节点/边按 visitedCount/selectedCount 着色，有向画箭头
- `LogRenderer`：等宽日志文本
- `formatValue`：统一值格式化

注意：渲染器接收 tracer 内部数组/对象的**引用**（重放时原地 mutate），故**不可** `React.memo`——引用不变会漏更新。


## 算法 demo 契约 (algorithms/types.ts)

```ts
AlgorithmDemo {
  id, kind: 'sort'|'search'|'graph'|'string'|'dp'|'greedy',
  title, description, complexity, notes(不变式),
  annotations?: Record<行号, 中文讲解>,   // SourcePanel 旁注
  statLabels?: Record<method, 标签>,      // StatsBar 中文标签
  configLabels?: { n?, m? },              // dp 类 n/m 参数语义
  defaultConfig,                          // SortConfig | GraphConfig | StringConfig | DpConfig | GreedyConfig
  commands(cfg: DemoConfig): Command[],
  source,                                 // ?raw 导入
}
```

`demos: Record<分类key, AlgorithmDemo[]>`（algorithms/index.ts）。

生成器 (generators.ts)：`generateSortData`（四分布，分布表 `DISTRIBUTIONS`）/ `generateMatrix`（树骨架 + 补边，保证连通）/ `generateWeighted`（复用 matrix 结构，权重 = 1 + ⌊弦长/120⌋ 由 `circleCoord` 圆布局几何确定，保证 Dijkstra/A* 的启发式 h 可采纳）/ `generateStrings`（'ab' 字母表，模式串保证匹配）/ `generateValues`（LIS）/ `generateWords`（'abc' 字母表）/ `generateIntervals`（区间长度 1..5）。全部基于 `mulberry32(seed)`，同种子同序列；模拟掷骰用 `randomSeed()`（core/random.ts）。

## delay-line 插件 (plugins/delay-line.ts)

transform 钩子，仅匹配 `src/algorithms/*.ts`（排除 ?raw）。字符级扫描跳过字符串/`//`/`/* */`，把空参 `delay()` 重写为 `delay(当前行号)`。算法源码显示用 `?raw` 原文，互不干扰。

## 路由 (router.ts)

hash 单一事实源，`hashchange` 驱动视图，刷新与分享不丢状态。

- `#/` 着陆页；`#/lab/{category}/{demoId}?cfg=<json>` 实验室
- `parseHash()`：宽松解析，白名单校验在 Shell 的 `resolveRoute`（未匹配回退 sorting 首个 demo）
- `labHash(category?, demoId?, cfg?)`：构造 hash；cfg 为 JSON + encodeURIComponent，即种子快照分享
- 写 hash 统一收敛在本模块（组件直接改 `window.location` 会被 react-immutability 规则拦截）：`navigateLab(category?)` / `navigateHome()` / `navigateTo(category?, demoId?)` 写 `location.hash`（产生历史记录，后退可回）；`replaceHash(category?, demoId?, cfg?)` 走 `history.replaceState`（参数调整不污染历史）

## 组件职责 (components/)

- `Shell`：AppShell（navbar 分类 / aside 设置）；路由 prop 经 `resolveRoute` 白名单校验后以渲染期重置同步（禁 effect 级联）；导航动作只写 hash；React.lazy 按需加载
- `Home`：着陆页，`onEnter(category)` 写 `#/lab/{category}`
- `AlgorithmStage`：Grid 双栏（左可视化 + 统计 + 播放器 + 不变式，右粘性 SourcePanel）；SegmentedControl 切 demo
- `SourcePanel`：行号 + 代码 + 注释三列；当前行 = `viz.chunks[cursor-1].lineNumber`；点击行 seek；highlight.ts 轻量 tokenize
- `Player`：播放/步进/进度/速度；键盘 Space/←→（输入框聚焦忽略）
- `StatsBar`：steps + byMethod 徽章
- `SettingsPanel`：按 kind 渲染参数控件，改动即时重录
- `VisualizationViewer`：引擎 root 递归渲染，处理 setRoot/destroy/构造命令

## 模拟专题 (sims/)

独立于命令重放引擎的交互模拟：无命令流/源码面板，仅画布 + 参数控件，自持 rAF 循环。`SimDemo { id, kind:'sim', title, description }`（sims/index.ts），`simRegistry: Record<id, ComponentType<SimProps>>` 映射组件，`simDemos` 数组供 Shell 分类导航。7 个：生命游戏 / 遗传算法 / 地图生成 / RTS 流场 / 怪物 AI / 生存进化 / Boids。

公共设施 (shared.ts)：

- `SimProps { scheme }`：只接收深浅色——canvas 内读不了 CSS 变量
- `simColors(scheme)`：按色模式返回主题色（bg/grid/wall/accent/info/good/bad/warn/dim/text）
- `fitCanvas(canvas)`：DPR 适配（上限 2），返回 `{ctx,w,h}` 或 null（零尺寸/无 2D 上下文）
- `useSimLoop(ref, running, draw)`：rAF 循环，draw 每帧取最新闭包（参数改动即时生效）；ResizeObserver 保证暂停/缩放也重绘当前帧（dt=0）；dt 上限 0.1s 防切后台跳帧
- `useResize(ref, cb)`：静态画布（地图生成）的重绘入口
- `drawHud(ctx, text, dim)`：canvas 内左上角文字，避免高频 setState
- 会话统计 `statStore`（模块级 Map）：`statGet/statAdd/statSet/statMax`，切页保留、刷新即清零

控件 (controls.tsx)：`PlayButton / ResetButton / DiceButton / ParamSlider / SimStats`（SimStats 400ms `setInterval` 轮询 `statGet` 刷新）。

约定：世界数据存 `useRef`，参数经 state 每帧读取；种子化 `mulberry32`，掷骰 `randomSeed()`，重置须可复原种子。

## 样式规约

Mantine 交互组件 + Tailwind 原子类（跳过 preflight）+ SCSS module（手写样式唯一入口，`@use '../styles/mixins' as m`）。深浅色经 `data-mantine-color-scheme` 桥接。

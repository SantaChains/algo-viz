# 架构现状与演进路线

定位：纯前端算法可视化与模拟专题，零运行时服务端依赖，构建产物自足，可在任意静态托管（GitHub Pages / Cloudflare Pages / NGINX）直接运行。

## 一、架构现状

四层结构，依赖单向向下：

- algorithms：算法纯函数。每步向 tracer 发命令（create/visit/select/patch 等），输出命令流。源码经 vite `?raw` 静态内联进学习面板，无运行时 fetch。
- core：engine（命令流重放）、tracers（数据结构状态机）、renderers（SVG/2D 渲染）、random（种子化 PRNG）。
- components：Shell（hash 路由 + 分类导航）、AlgorithmStage（算法页装配）、Player（命令流播放器）、SimulationStage（模拟页装配）、Home（流场着陆页）。
- sims：模拟专题，独立于命令重放引擎。每页自持 rAF 循环（shared.ts：useSimLoop / fitCanvas DPR / simColors 主题色 / 会话统计 statStore），世界数据存 useRef，参数经 state 每帧读取。

路由：hash 路由（#/lab/{category}/{demoId}?cfg=快照），demo 配置可编码进 URL，无历史记录污染，天然免 404 fallback。

数据：当前零持久化。会话统计（statStore）为模块级 Map，切页保留、刷新即清。这是 SQLite 路线的切入点。

## 二、静态托管约束清单

产物满足以下条件即任何静态平台可托管，已逐项达成或落地：

1. base 子路径：vite.config 经 `BASE_PATH` 环境变量注入 base，index.html 内资源引用构建时自动重写。本地开发与根域名部署不需要任何配置。
2. 无绝对路径运行时请求：源码面板走 `?raw` 编译期内联；无 fetch/XHR；字体走系统字体栈。
3. hash 路由：服务端只需一个 index.html，无 404 fallback / rewrite 规则需求。
4. 资源可长缓存：assets 文件名带内容 hash，index.html 为入口（托管平台默认不缓存 HTML）。
5. 无 SSR/Edge 依赖：无 serverless 函数也可完整运行。

## 三、SQLite 三层路线

原则：JSON 命令轨迹永远是 canonical 数据。SQLite 只是索引、缓存与持久化选项，任何一层缺失系统都完整可用。三层相互独立，可按需逐层采用。

A. 构建期 SQLite（作者侧，零运行时成本）

- 形态：`bun:sqlite` 脚本把 demo 元数据（id/分类/参数/描述）与命令轨迹入库；构建时执行校验（id 唯一、轨迹可重放、参数齐备）并导出 JSON。
- 收益：demo 数量增长后的体检（孤儿注册、轨迹损坏、重复 id）、检索统计（哪类 demo 步数分布）、为未来「数据库即源头」铺路。
- 成本：仅构建脚本与 CI 一步，产物仍是纯静态 JSON。
- 触发时机：demo 超过 30 个或出现轨迹回归问题时再做，当前 18 个（11 算法 + 7 模拟）规模收益不足。

B. 运行时 sqlite-wasm + OPFS（用户侧持久化）

- 形态：`@sqlite.org/sqlite-wasm`，OPFS 挂载在 worker 内用 sync access handle，不需要 SharedArrayBuffer，也就不需要 COOP/COEP 响应头——静态托管零配置可用。
- 落地路径：先抽 `storage.ts` 适配层（get/set/subscribe），默认实现 localStorage；wasm 可用时升级为 OPFS SQLite。数据：模拟统计持久化、算法参数快照、自定义输入。
- 风险与边界：wasm 约 1MB（懒加载，仅进入需要持久化的页面再拉）；iOS Safari OPFS 配额行为需实测；隐私模式降级回 localStorage。
- 触发时机：用户希望「统计与设置刷新不丢」时做，是三层中最先值得做的一层。

C. Cloudflare Pages Functions + D1（可选服务端增强）

- 形态：CF 平台专属渐进增强。`/api/*` 由 Functions 提供，D1 存跨设备同步数据（进度、排行榜、分享的 cfg 快照）。
- 降级约定：客户端启动时 feature-detect `/api/health`，失败即静默降级到 B 层。同一份代码在 GitHub Pages 上自动运行在 B 层，不报错、不减功能（仅缺跨设备同步）。
- 触发时机：出现多设备/社区分享需求再做。

## 四、细节调整路线（按优先级）

1. base 注入——已落地（vite.config BASE_PATH + Actions workflow + docs/deployment.md）。
2. 路由级代码分割：Home 与 lab 拆 React.lazy，Mantine 图标按需导入已 tree-shaking；主包 350KB 中 Shell/Stage 占比高，懒加载可再压首屏。
3. B 层试点：sim 统计接 storage.ts + localStorage（半天工作量，先于 wasm）。
4. 模拟专题健康度：SimHunt 连通性保证与卡死看门狗已落地；其余模拟统一「重置必须可复原种子」约定。
5. A 层构建体检脚本：等 demo 规模触发。

## 五、取舍记录

- 不引入服务端渲染：内容是交互工具不是内容站，SSR 无收益。
- 不默认上 wasm SQLite：localStorage 覆盖九成需求，wasm 体积与平台差异只在真正需要文件级持久化时才值回成本。
- 不做通用后端：部署面越窄，静态托管的免费额度与可靠性红利越大；服务端只以 CF Functions 可选层的形式出现。

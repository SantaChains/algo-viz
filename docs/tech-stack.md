# algo-viz 技术栈接口参考

以 bun.lock 锁定版本为准，全部经官方源核实。
核实日期 2026-09-15。

版本总览

- bun 1.4.2（工具链，非 lock 依赖）
- typescript 7.0.2（Go 原生编译器，即 tsgo 的稳定形态）
- vite 8.3.0 + @vitejs/plugin-react 6.1.1
- react / react-dom 19.3.0
- @mantine/core / @mantine/hooks 9.6.1
- @tabler/icons-react 3.46.0
- sass-embedded 1.104.1
- postcss 8.5.28 / postcss-preset-mantine 1.18.0 / postcss-simple-vars 7.0.1
- oxlint 1.83.0

## TypeScript 7（tsgo）

版本关系：tsgo 是 @typescript/native-preview 包的 CLI 名，用于 beta/nightly 通道。TypeScript 7.0 已于 2026-07-08 随 npm `typescript` 包稳定发布，bin 名回归 `tsc`，但编译器本体就是此前 tsgo 的 Go 原生代码（Project Corsa）。本项目 devDependencies 安装 typescript@^7.0.2，scripts 中 `tsc` 即原生编译器，无需依赖全局 tsgo。全局 tsgo（7.0.0-dev.20260707.2）为 nightly 快照，仅作对照，两者可并存。

常用命令

- `tsc -b` 增量构建 + project references（本项目 typecheck/build 用法，references 并行化）
- `tsc --noEmit`
- `tsc --watch`（重写的 watcher，基于 Go 移植的 Parcel watcher）
- `--checkers N` 类型检查并行度，默认 4；`--singleThreaded` 关闭并行

TS 6/7 行为要点

- 语义与 6.0 结构性一致，官方承诺零语义差异（本项目实测：升级后产物 hash 与 6.0 完全相同）
- strict 与 module: esnext 成为默认
- 6.0 的弃用项在 7.0 变硬错误：target: es5、baseUrl、moduleResolution: node 等。本项目用 es2023 + bundler，不触及
- 编译器 API（`import * as ts from 'typescript'`）在 7.0 不保证稳定，稳定 API 目标 7.1。依赖 compiler API 的工具（typescript-eslint 等）如需接入，用 `@typescript/typescript6` 别名包过渡
- 编辑器：VS Code / Trae 安装扩展 TypeScript (Native Preview)（ID: TypeScriptTeam.native-preview）启用原生 LSP

来源：devblogs.microsoft.com/typescript/announcing-typescript-7-0/、npmjs.com/package/typescript、npmjs.com/package/@typescript/native-preview

## Vite 8.3

Rolldown（Rust）统一打包器替代 esbuild+Rollup 双引擎，插件 API 兼容 Rollup。

核心接口

- `defineConfig({ plugins, css, server, build, ... })`
- 插件：`{ name, applyToEnvironment, configResolved, transform, closeBundle, closeServer, closePreviewServer }`（后两个 8.3 新增）
- CSS：.scss/.sass 内置支持，默认 modern-compiler API，自动优先 sass-embedded；`css.preprocessorOptions.scss` 可调
- 依赖预构建：`optimizeDeps.rolldownOptions`（esbuildOptions 已弃用，自动转换层兼容）
- 资产 URL：`import.meta.ROLLDOWN_FILE_URL_*`（8.3 新，替代原 new URL 资产引用的内部通道）
- 8.3 其他：顶层 `tsconfig` 配置项；`server.watch` 接受 Rolldown watch 选项；devtools dev server 集成；`--profile [name]` CPU 剖析
- 默认浏览器目标更新至 Baseline 2026-01：Chrome/Edge 111、Firefox 114、Safari 16.4
- 环境变量：`import.meta.env.MODE/.DEV/.PROD`，`.env` 文件 `VITE_` 前缀

来源：vite.dev/blog/announcing-vite8.html、main.vitejs.dev/blog/announcing-vite8-1、github.com/vitejs/vite CHANGELOG v8.3.0

## React 19.3

2026-09-09 发布。核心新 API：

- `<ViewTransition>`：稳定。包住元素，在 startTransition/Suspense/useDeferredValue 更新中自动播放 enter/exit/update/share 动画；配 `addTransitionType` 按更新来源定制动画；仅 DOM 环境
- Fragment Refs：稳定。`<Fragment ref={...}>` 返回 FragmentInstance，可对一组子节点 addEventListener/focus/measure/observer
- `browser()`：`use(browser())` 在服务端触发最近 Suspense fallback，客户端原样渲染，替代 mounted 标志
- Trusted Types 支持；Server Components 可直接渲染 Context 无需包装组件

沿用要点

- hooks：useState/useReducer/useEffect/useLayoutEffect/useMemo/useCallback/useRef/useContext/ctx + use(Promise|Context)/useOptimistic/useActionState/useDeferredValue/useSyncExternalStore/useId/useTransition/startTransition
- 19.2：`useEffectEvent`、`<Activity>`、Performance Tracks
- ref 可作为普通 prop 传递；ref cleanup 函数
- React Compiler v1.0 已稳定（2025-10），oxlint 的 react hooks 规则与本模板 set-state-in-effect 检查同源

本项目 StrictMode 下禁止 effect 内同步 setState（oxlint react/set-state-in-effect），派生状态在事件处理器中完成。

来源：react.dev/blog/2026/09/09/react-19-3、react.dev/blog

## Mantine 9.6

9.0（2026-03-31）起要求 React 19.2+。

接线约定（本项目已配置）

- 根组件：`<MantineProvider theme={theme} defaultColorScheme="auto">`，theme 用 `createTheme()`
- 样式：`import '@mantine/core/styles.css'`；附加包（dates/charts/notifications 等）各自 `styles.css`
- 防 FOUC：index.html 内联脚本设置 `data-mantine-color-scheme`，localStorage 键 `mantine-color-scheme-value`（默认 ColorSchemeManager）
- 常用 CSS 变量：--mantine-color-body、--mantine-color-text、--mantine-color-default-border、--mantine-radius-*、--mantine-scale
- 配色切换：`useMantineColorScheme().setColorScheme('light'|'dark'|'auto')` + `useComputedColorScheme('light')`

9.x 破坏点（写代码时规避）

- Text/Anchor 的 color prop 已移除，用 `c` style prop
- TypographyStylesProvider 更名 Typography
- useHeadroom 返回 `{ pinned, scrollProgress }` 而非 boolean
- form 校验走 Standard Schema：`validate: schemaResolver(schema)`（zodResolver 已移除）
- light variant 改实色变量；需 8.x 行为用 `v8CssVariablesResolver`
- Popover/Tooltip 移除 positionDependencies

9.1-9.6 新增：TreeSelect、useDrag、notifications 滑动关闭、@mantine/lightbox、@mantine/schedule、notifications.show({ renderNotification })

常用 hooks：useDisclosure、useHotkeys、useDebouncedValue、useMediaQuery、useLocalStorage、useIdle、useElementSize

来源：mantine.dev/changelog/9-0-0、mantine.dev/guides/8x-to-9x、mantine.dev/changelog/9-6-0

## @tabler/icons-react 3.46

- `import { IconSun, IconMoon } from '@tabler/icons-react'`，按名导入即 tree-shaking
- 组件 props：size、stroke、color、className、style、title、aria-* 等 SVG 透传
- 类型：`import type { Icon } from '@tabler/icons-react'`（ForwardRefExoticComponent）；TablerIconsProps 类型名不导出，勿用

来源：npmjs.com/package/@tabler/icons-react

## sass-embedded 1.104 + postcss-preset-mantine 1.18（双轨样式）

Vite 处理顺序：Sass 先编译 .scss，产物再过 PostCSS。由此产生两条规则（本模板核心约定）：

1. .css 文件：postcss-preset-mantine 全功能可用
   - 函数：rem(16px)、em(320px)、alpha()、light-dark(红, 蓝)
   - mixin：@mixin light/dark、light-root/dark-root、smaller-than/larger-than（后者配 $mantine-breakpoint-* 变量，由 postcss-simple-vars 提供）
   - autoRem 选项可自动 px→rem
2. .scss 文件：Sass 会吞掉 @mixin 声明、且内置两参 rem()/em() 覆盖 preset 函数。统一走 src/styles/_mixins.scss 命名空间：
   - `@use '../styles/mixins' as m;`
   - `@include m.dark { }`、`@include m.light { }`、`@include m.larger-than(m.$bp-sm) { }`、`@include m.smaller-than(m.$bp-md) { }`
   - `m.rem(300px)` 输出与 preset 一致的 `calc(...rem * var(--mantine-scale))`
   - light-dark() 在 .scss 中正常透传可用

断点（两轨一致）：xs 36em / sm 48em / md 62em / lg 75em / xl 88em

Sass 侧：@use 模块系统（禁 @import）、`@use 'sass:math'`、postcss.config.cjs 必须为 .cjs（bun/ESM 项目）

来源：mantine.dev/styles/postcss-preset、sass-lang.com/documentation

## Bun 1.4

2026-08-20 发布，运行时核心 Zig→Rust 重写。包管理命令：

- `bun add [pkg]` / `bun add -d [pkg]`：安装并写入 package.json
- `bun remove [pkg]`
- `bun update [pkg]`：1.4 起默认原地更新传递依赖（pnpm parity）
- `bun audit` / `bun audit fix [--dry-run] [--latest]`
- `bun dedupe` / `bun prune`
- `bun pm untrusted` / `bun pm trust [pkg]`：postinstall 拦截与放行（本项目拦截了 @parcel/watcher，Vite 有 chokidar 兜底，无需放行）
- `bun run [script]`：解析 node_modules/.bin 优先于全局；`bun run --parallel` 并行跑多 script
- `bun install --frozen-lockfile`：CI 用
- bun.lock 为文本 JSONC，不读 package-lock.json

运行时内置（写脚本时优先考虑）：Bun.serve（1.4.1 起 HTTP/1.1+2 同端口）、Bun.build、Bun.Image、Bun.WebView（CDP 驱动本地 Chrome）、Bun.cron、Bun.Terminal、Bun.markdown、Bun.XML、Bun.SQL、Bun.Archive。Bun 只做类型剥离不做类型检查，类型守门仍由 tsc 负责。

来源：bun.com/blog/bun-v1.4、bun.com/blog/bun-v1.4.1

## oxlint 1.83

- 配置 .oxlintrc.json：`$schema` 指向 node_modules/oxlint/configuration_schema.json；`plugins: ["react", "typescript", "oxc"]`；规则 `rules: { "react/rules-of-hooks": "error", "react/only-export-components": ["warn", { allowConstantExport: true }] }`
- 命令：`oxlint .`、`oxlint -c <file> .`；支持 `--fix`
- 本项目当前 0 警告基线：新增代码不得引入 lint 警告

来源：oxc.rs/docs/guide/usage/linter

## Tailwind v4 混用（4.3.3）

接入方式（已落地）

- `@tailwindcss/vite` 插件加入 vite.config.ts；入口 src/styles/tailwind.css
- 分层导入 theme + utilities，跳过 preflight——preflight 的 reset 会破坏 Mantine 组件外观（button 透明背景、border 继承 currentColor）
- dark 桥接：`@custom-variant dark (&:where([data-mantine-color-scheme='dark'], [data-mantine-color-scheme='dark'] *))`，dark: 变体与 Mantine 配色方案同源联动（含 auto 跟随系统）
- 导入顺序：mantine styles.css -> tailwind.css -> global.scss
- 优先级规则：Mantine styles.css 为 unlayered，优先于 @layer 内的 utilities。Tailwind 类只对 Mantine 未设置的属性生效（margin、grid 布局等）；需覆盖 Mantine 组件自身属性时用重要后缀（v4 语法 bg-red-500!）或改走 SCSS

手写样式约束：一律 *.module.scss；tailwind.css 仅为工具类入口，不写手写规则

选型矩阵

- 交互组件（AppShell/Modal/Menu/Slider/Tabs/Form/Notification）：Mantine，开箱完整且主题统一
- 布局结构、间距微调、一次性状态类：Tailwind 原子类
- 主题化视觉、配色语义、动画、跨组件共享样式：SCSS modules（m.dark / light-dark()）
- shadcn 按需后补：仅在需要 Mantine 覆盖外的生态件时引入（cmdk 命令面板、sonner toast、recharts 图表包装等），注意三点——shadcn 主题变量（--background 等）需与 Mantine CSS 变量做映射；其 dark 模式选择器 .dark 需改为 [data-mantine-color-scheme='dark']；tailwind 初始化现已就绪，shadcn init 可直接进行
- 禁止双组件并存：同一交互角色不要同时保留 Mantine 与 shadcn 两套实现

范例：components/StyleBridgeDemo.tsx（查找/动态规划/贪心/字符串占位页）三块色卡分别演示 Tailwind dark: 变体、SCSS m.dark、同元素三轨混用，切换配色三轨同步。

来源：tailwindcss.com/docs/installation/using-vite、mantine.dev/styles/usage

## 脚本与验证

package.json scripts

- dev：vite 开发服务器（当前默认端口 5173）
- build：tsc -b && vite build
- typecheck：tsc -b
- lint：oxlint
- preview：vite preview

变更依赖后最低验证集：bun run typecheck && bun run lint && bun run build

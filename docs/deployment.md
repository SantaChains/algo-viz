# 部署指南

项目为纯前端静态产物：hash 路由免 404 fallback，源码 `?raw` 编译期内联，无运行时网络请求。构建后 `dist/` 可托管于任何静态平台。

## base 子路径机制

vite.config.ts 读取环境变量 `BASE_PATH` 决定 base，默认 `/`：

- GitHub Pages 项目页（`user.github.io/<repo>`）：CI 注入 `BASE_PATH=/<repo>`。
- 根域名 / 自定义域名 / Cloudflare Pages：不设置，走默认 `/`。
- index.html 内的 `/favicon.svg` 等引用由 Vite 构建时自动按 base 重写，代码内无需感知。

本地验证子路径构建（PowerShell）：

```powershell
$env:BASE_PATH='/algo-viz'; npx vite build; npx vite preview
# 浏览器访问 http://localhost:4173/algo-viz/ 确认资源全部命中
```

## GitHub Pages（Actions）

workflow 位于 `.github/workflows/deploy.yml`：checkout → setup-bun → `bun install --frozen-lockfile` → `bun run build`（注入 BASE_PATH）→ upload-pages-artifact → deploy-pages（官方四件套，OIDC 免 token）。

启用步骤：

1. 将 algo-viz 推为独立 GitHub 仓库（当前 workflow 放在 algo-viz 目录内，嵌套仓库中不生效；独立成仓后自动生效）。
2. 仓库 Settings → Pages → Source 选 GitHub Actions。
3. push 到 main 或手动 workflow_dispatch 触发；首次约 2 分钟出地址 `https://<user>.github.io/<repo>/`。

注意：

- 仓库名若为 `<user>.github.io` 或绑定自定义域名，把 workflow 中 `BASE_PATH` 改为 `/`。
- 锁文件为 bun.lock，CI 必须用 bun 装依赖；换 npm 需先提交 package-lock.json 并把缓存改为 `cache: npm`。
- 若坚持在 learn 大仓库内托管：把 workflow 移至仓库根 `.github/workflows/`，push 触发加 `paths: ['01-rust_cli/chromaflow/web/algo-viz/**']`，build 步骤加 `defaults.run.working-directory` 与 `working-directory` 指向该子目录，BASE_PATH 用 `${{ github.event.repository.name }}` 之外的自定义值（大仓 Pages 会整仓部署，不推荐）。

## Cloudflare Pages

1. Dashboard → Workers & Pages → Create → Pages → 连接 Git 仓库。
2. 构建配置：
   - Framework preset: 无（或 Vite）
   - Build command: `bun run build`（构建镜像内置 bun；用 npm 则 `npm run build`）
   - Build output directory: `dist`
   - 环境变量：无需设置（根域名部署，base 默认 `/`）
3. Node/bun 版本可用环境变量指定：`BUN_VERSION` 或 `NODE_VERSION`。
4. hash 路由无需 `_redirects` / `404.html`。

## 平台无关事项

- 资源缓存：assets 带 hash 可长缓存；两平台默认策略即可，无需自定义 header。
- `public/` 内 favicon.svg 原样拷贝，注意引用一律走根路径 `/xxx` 让 Vite 重写。
- 部署后冒烟检查清单：着陆页流场动画 → 任一算法页播放 → 任一模拟页交互 → 深浅色切换 → 直接刷新 `#/lab/...` 深链可还原。

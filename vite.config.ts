import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { delayLine } from "./plugins/delay-line.js";

// https://vite.dev/config/
export default defineConfig({
  // 子路径托管注入：GitHub Pages 项目页 CI 设 BASE_PATH=/<repo>，本地与根域名部署默认 '/'
  base: process.env.BASE_PATH || "/",
  plugins: [react(), tailwindcss(), delayLine()],
});

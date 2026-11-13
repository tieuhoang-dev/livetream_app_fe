import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const target = env.VITE_API_URL || "http://127.0.0.1:8080";
  const proxy = {
    "/api": { target, changeOrigin: true, ws: true },
    "/uploads": { target, changeOrigin: true },
  };
  return { plugins: [react()], server: { proxy }, preview: { proxy } };
});

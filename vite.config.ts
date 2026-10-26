import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "/gallery/",
  root: "gallery",
  publicDir: "public",
  build: {
    outDir: "../dist/gallery/gallery",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});

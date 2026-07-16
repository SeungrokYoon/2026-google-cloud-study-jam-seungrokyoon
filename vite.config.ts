import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "public"), // public 폴더를 소스 및 entry 루트로 지정
  build: {
    outDir: resolve(__dirname, "dist"), // 빌드 출력 디렉토리를 루트 dist로 설정
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "public/index.html"),
        contribute: resolve(__dirname, "public/contribute.html")
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});

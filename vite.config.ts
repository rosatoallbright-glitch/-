import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
    watch: {
      ignored: ["**/data.db", "**/data.db-wal", "**/data.db-shm", "**/server/**", "**/教材库/**", "**/node_modules/**"],
    },
  },
});
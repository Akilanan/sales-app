import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Don't trigger HMR reloads when screenshots / logs / build artifacts are
    // written into the project during verification.
    watch: { ignored: ["**/.refs/**", "**/.playwright-mcp/**", "**/*.png", "**/*.jpg", "**/*.log"] },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the main bundle into long-cacheable vendor chunks (three/drei are
        // already in the lazy hero chunk via React.lazy on Ambient).
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["framer-motion"],
          charts: ["recharts"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});

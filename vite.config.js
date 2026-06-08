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
        // NOTE: framer-motion is intentionally NOT manually chunked — LazyMotion
        // async-loads its feature set (src/lib/motion-features), so Rollup splits
        // the heavy features into their own deferred chunk. Forcing it into one
        // vendor chunk here would eagerly load those features and negate the win.
        manualChunks: {
          react: ["react", "react-dom"],
          charts: ["recharts"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});

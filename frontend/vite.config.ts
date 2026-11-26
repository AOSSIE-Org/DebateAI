import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import svgr from "@svgr/rollup"; // Import the plugin

// https://vitejs.dev/config/
export default defineConfig({
  // Defaults to '/'. Set VITE_PUBLIC_PATH (e.g. '/DebateAI/') when the app is
  // served from a sub-path such as a GitHub Pages project site.
  base: '/',
  plugins: [react(),  svgr(), ],

  //shadcn
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

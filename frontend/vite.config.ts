import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import svgr from "@svgr/rollup"; // Import the plugin

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(),  svgr(), ],

  //shadcn
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

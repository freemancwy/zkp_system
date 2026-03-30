import path from "node:path"
import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      ethers: path.resolve(
        __dirname,
        "../ZKP_chain/node_modules/ethers/lib.esm/index.js"
      ),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
})

import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://portfolio.willredington.com",
  integrations: [mdx(), sitemap()],
  output: "static",
  build: {
    assets: "_assets",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

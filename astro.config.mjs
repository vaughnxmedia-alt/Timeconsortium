import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://www.thomasconsortium.com",
  output: "static",
  adapter: node({ mode: "standalone" }),
  trailingSlash: "never",
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/staff"),
      customPages: ["https://www.thomasconsortium.com/vendor-hub"],
    }),
  ],
  devToolbar: { enabled: false },
});

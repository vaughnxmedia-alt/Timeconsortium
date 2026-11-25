import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://www.thomasconsortium.com",
  output: "static",
  adapter: vercel(),
  security: {
    allowedDomains: [
      { hostname: "www.timelessconsortium.com", protocol: "https" },
      { hostname: "timelessconsortium.com", protocol: "https" },
    ],
  },
  trailingSlash: "never",
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/staff"),
      customPages: ["https://www.thomasconsortium.com/vendor-hub"],
    }),
  ],
  devToolbar: { enabled: false },
});

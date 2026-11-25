import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://www.timelessconsortium.com",
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
      customPages: ["https://www.timelessconsortium.com/vendor-hub"],
    }),
  ],
  devToolbar: { enabled: false },
});

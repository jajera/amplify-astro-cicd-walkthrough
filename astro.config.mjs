import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { starlightBasePath } from "starlight-base-path";

export default defineConfig({
  site: "https://amplify-astro-cicd-walkthrough.johna.kiwi",
  base: "/",
  integrations: [
    starlight({
      title: "Amplify Astro CI/CD",
      favicon: "/favicon.svg",
      description:
        "Deploy Astro to Amplify with staging, PR previews, GitHub App, CI gates, and teardown.",
      plugins: [starlightBasePath()],
      routeMiddleware: "./src/routeData.ts",
      customCss: [
        "./src/styles/patina-tokens.css",
        "./src/styles/splash-overrides.css",
      ],
      components: {
        ThemeSelect: "./src/components/ThemeSelect.astro",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/jajera/amplify-astro-cicd-walkthrough",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/jajera/amplify-astro-cicd-walkthrough/edit/main/",
      },
      lastUpdated: true,
      pagination: true,
      sidebar: [
        { label: "Home", link: "/" },
        {
          label: "Concepts",
          items: [
            { slug: "concepts/amplify-hosting" },
            { slug: "concepts/github-app-vs-pat" },
            { slug: "concepts/staging-and-previews" },
          ],
        },
        {
          label: "Architecture",
          items: [{ slug: "architecture/promotion-flow" }],
        },
        {
          label: "Deploy and Operate",
          items: [
            { slug: "deploy-and-operate/prerequisites" },
            { slug: "deploy-and-operate/scaffold-astro" },
            { slug: "deploy-and-operate/github-branches-and-ci" },
            { slug: "deploy-and-operate/create-amplify-app" },
            { slug: "deploy-and-operate/previews-and-auto-delete" },
            { slug: "deploy-and-operate/prove-the-flow" },
            { slug: "deploy-and-operate/teardown" },
          ],
        },
        {
          label: "Reference",
          items: [
            { slug: "reference/amplify-yml" },
            { slug: "reference/cost" },
            { slug: "reference/troubleshooting" },
          ],
        },
      ],
    }),
  ],
});

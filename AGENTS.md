# Agent notes

## Repos

| Repo | Role |
|------|------|
| `jajera/amplify-astro-cicd-walkthrough` | This docs site (GitHub Pages) |
| `jajera/amplify-astro-cicd` | Minimal Astro sample hosted on Amplify |

Do not invent Amplify app IDs or custom domains for the sample. Lab hosting uses default `*.amplifyapp.com` URLs only.

## Docs source of truth

Walkthrough steps live in `src/content/docs/**/*.mdx`. Keep sidebar slugs in `astro.config.mjs` aligned with those files.

## Site URL

Production docs: `https://amplify-astro-cicd-walkthrough.johna.kiwi` (Pages + Route 53 CNAME via johna-kiwi-infra `sites.yaml`).

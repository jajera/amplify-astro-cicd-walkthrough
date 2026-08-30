export type GlossaryEntry =
  | string
  | {
      definition: string;
      url?: string;
      urlLabel?: string;
    };

export const glossary: Record<string, GlossaryEntry> = {
  amplify: {
    definition:
      "AWS Amplify Hosting - managed CDN hosting for front-end web apps. Git-connected continuous deployment is one option; this lab uses that path for branch and PR preview URLs.",
    url: "https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html",
    urlLabel: "Amplify Hosting docs",
  },
  "amplify-yml":
    "Root amplify.yml file that tells Amplify how to install, build, and which artifact directory to publish.",
  "github-app":
    "Amplify GitHub App - OAuth install that lets Amplify clone your repo and receive push/PR webhooks without a long-lived personal access token.",
  staging:
    "Long-lived Git branch (and Amplify branch) used as a pre-production environment before promoting to main.",
  "pr-preview":
    "Temporary Amplify hosting URL created for a pull request so you can review the built site before merge.",
  "branch-auto-delete":
    "Amplify setting that automatically removes a preview host when its Git branch is deleted. Same end state as deleting that Amplify branch in the Console.",
  "astro": {
    definition:
      "Static site framework used for the sample app in this lab - Amplify runs npm ci and astro build, then publishes dist/.",
    url: "https://docs.astro.build/",
    urlLabel: "Astro docs",
  },
  "ci-gate":
    "GitHub Actions checks plus branch protection - required before merge. Amplify does not wait for CI by itself; it builds on push.",
};

export function resolveGlossaryEntry(entry: GlossaryEntry | undefined) {
  if (!entry) return { definition: undefined, url: undefined, urlLabel: undefined };
  if (typeof entry === "string") {
    return { definition: entry, url: undefined, urlLabel: undefined };
  }
  return {
    definition: entry.definition,
    url: entry.url,
    urlLabel: entry.urlLabel ?? entry.url,
  };
}

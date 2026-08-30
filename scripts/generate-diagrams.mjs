import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public/diagram-icons");
const publicDir = join(root, "public");
const localAws = join(root, "../aws-icons");
const localArch = join(root, "../arch-icons");

const AWS_ICONS_BASE = "https://jajera.github.io/aws-icons";
const ARCH_ICONS_BASE = "https://jajera.github.io/arch-icons";

const THEMES = {
  dark: {
    name: "dark",
    bgTop: "#0b171c",
    bgBottom: "#071014",
    frameStroke: "#1e3a44",
    panelFill: "#0f1f26",
    panelStroke: "#23404a",
    panelLabel: "#eef8fa",
    title: "#eef8fa",
    muted: "#b7cdd4",
    arrow: "#3d6b78",
    pillFill: "#14303a",
    accent: "#22d3ee",
    accentInk: "#04222a",
    goodFill: "#0f2a24",
    goodStroke: "#1d6b5a",
    badFill: "#2a1414",
    badStroke: "#7a3030",
  },
  light: {
    name: "light",
    bgTop: "#f7fbfc",
    bgBottom: "#eef4f6",
    frameStroke: "#c5d4d8",
    panelFill: "#ffffff",
    panelStroke: "#c5d4d8",
    panelLabel: "#102830",
    title: "#102830",
    muted: "#3a5560",
    arrow: "#7a9aa6",
    pillFill: "#e8f2f5",
    accent: "#0b6f88",
    accentInk: "#ffffff",
    goodFill: "#e8f6f1",
    goodStroke: "#1d6b5a",
    badFill: "#f8eaea",
    badStroke: "#9a4040",
  },
};

mkdirSync(iconsDir, { recursive: true });

function stripSvg(svgText) {
  return svgText
    .replace(/<\?xml[^?]*\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/g, "")
    .trim();
}

function scopeIconInner(inner, scopeId) {
  let out = inner;
  const ids = [...out.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  for (const oldId of [...new Set(ids)]) {
    if (oldId.startsWith(`${scopeId}-`)) continue;
    const newId = `${scopeId}-${oldId}`;
    out = out.replaceAll(`id="${oldId}"`, `id="${newId}"`);
    out = out.replaceAll(`url(#${oldId})`, `url(#${newId})`);
    out = out.replaceAll(`href="#${oldId}"`, `href="#${newId}"`);
  }
  const classNames = new Set();
  for (const m of out.matchAll(/\.([A-Za-z_][\w-]*)\s*\{/g)) classNames.add(m[1]);
  for (const m of out.matchAll(/\bclass="([^"]+)"/g)) {
    for (const c of m[1].trim().split(/\s+/)) if (c) classNames.add(c);
  }
  for (const cls of classNames) {
    if (cls.startsWith(`${scopeId}-`)) continue;
    const scoped = `${scopeId}-${cls}`;
    out = out.replace(new RegExp(`\\.${cls}(?=[\\s{,])`, "g"), `.${scoped}`);
    out = out.replace(new RegExp(`(?<=\\bclass="[^"]*)\\b${cls}\\b`, "g"), scoped);
  }
  return out;
}

function cleanSvgInner(svgText) {
  const stripped = stripSvg(svgText);
  const match = stripped.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (!match) throw new Error("Invalid SVG content");
  return match[1]
    .replace(/\bxlink:href=/g, "href=")
    .replace(/<(?:metadata|title|desc)[\s\S]*?<\/(?:metadata|title|desc)>/gi, "");
}

function getViewBox(svgText) {
  const stripped = stripSvg(svgText);
  const match = stripped.match(/viewBox="([^"]+)"/i);
  if (match) return match[1];
  const w = Number(stripped.match(/width="(\d+)/i)?.[1] ?? 64);
  const h = Number(stripped.match(/height="(\d+)/i)?.[1] ?? 64);
  return `0 0 ${w} ${h}`;
}

function parseViewBox(viewBox) {
  const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
  return { x, y, w, h };
}

const iconCache = new Map();

function recolorFills(svgText, fill) {
  return svgText.replace(/fill="#[0-9A-Fa-f]{3,8}"/g, `fill="${fill}"`);
}

async function fetchIcon(id, path, { base, localRoot, recolor } = {}) {
  if (iconCache.has(id)) return iconCache.get(id);
  const localPath = join(iconsDir, `${id}.svg`);
  let svgText;
  if (existsSync(localPath)) {
    svgText = readFileSync(localPath, "utf8");
  } else {
    const fromRepo = localRoot ? join(localRoot, path) : null;
    if (fromRepo && existsSync(fromRepo)) {
      svgText = readFileSync(fromRepo, "utf8");
    } else {
      const url = `${base}/${path}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
      svgText = await response.text();
    }
    if (recolor) svgText = recolorFills(svgText, recolor);
    writeFileSync(localPath, svgText);
  }
  const icon = {
    id,
    baseInner: cleanSvgInner(svgText),
    viewBox: getViewBox(svgText),
  };
  iconCache.set(id, icon);
  return icon;
}

function makeThemeHelpers(theme) {
  let iconInstance = 0;

  function bgGradient(id) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop stop-color="${theme.bgTop}"/>
      <stop offset="1" stop-color="${theme.bgBottom}"/>
    </linearGradient>`;
  }

  function framedRect(width, height, rx = 12) {
    return `<rect width="${width}" height="${height}" rx="${rx}" fill="url(#bg)"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${rx - 1}" stroke="${theme.frameStroke}" stroke-width="1" fill="none" opacity="0.7"/>`;
  }

  function wrapSvg(width, height, content) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" color-scheme="${theme.name}">
  <defs>${bgGradient("bg")}</defs>
  ${framedRect(width, height)}
  ${content}
</svg>`;
  }

  function hArrow(x1, x2, y) {
    return `<line x1="${x1}" y1="${y}" x2="${x2 - 10}" y2="${y}" stroke="${theme.arrow}" stroke-width="2"/>
  <polygon points="${x2 - 10},${y - 5} ${x2},${y} ${x2 - 10},${y + 5}" fill="${theme.arrow}"/>`;
  }

  function vArrow(x, y1, y2) {
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 8}" stroke="${theme.arrow}" stroke-width="2"/>
  <polygon points="${x - 5},${y2 - 8} ${x},${y2} ${x + 5},${y2 - 8}" fill="${theme.arrow}"/>`;
  }

  function nodeLabels(cx, labelY, title, subtitle) {
    let out = `<text x="${cx}" y="${labelY}" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="13" font-weight="600">${title}</text>`;
    if (subtitle) {
      out += `<text x="${cx}" y="${labelY + 16}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="11">${subtitle}</text>`;
    }
    return out;
  }

  function iconAt(icon, cx, iconY, size) {
    const scopeId = `${icon.id}-${iconInstance++}`;
    const inner = scopeIconInner(icon.baseInner, scopeId);
    const viewBox = parseViewBox(icon.viewBox);
    const scale = size / Math.max(viewBox.w, viewBox.h);
    const renderedW = viewBox.w * scale;
    const renderedH = viewBox.h * scale;
    const x = cx - renderedW / 2 - viewBox.x * scale;
    const y = iconY + (size - renderedH) / 2 - viewBox.y * scale;
    return `<g transform="translate(${x} ${y}) scale(${scale})">${inner}</g>`;
  }

  function iconNode(icon, cx, iconY, labelY, title, subtitle, size = 56) {
    return `${iconAt(icon, cx, iconY, size)}
  ${nodeLabels(cx, labelY, title, subtitle)}`;
  }

  function pill(cx, cy, text, { fill, stroke, ink } = {}) {
    const w = Math.max(text.length * 7.2 + 28, 72);
    const f = fill ?? theme.pillFill;
    const s = stroke ?? theme.panelStroke;
    const t = ink ?? theme.panelLabel;
    return `<rect x="${cx - w / 2}" y="${cy - 14}" width="${w}" height="28" rx="8" fill="${f}" stroke="${s}" stroke-width="1"/>
  <text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${t}" font-family="sans-serif" font-size="12" font-weight="600">${text}</text>`;
  }

  function mutedLabel(x, y, text, centered = false) {
    const anchor = centered ? "middle" : "start";
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${theme.muted}" font-family="sans-serif" font-size="11">${text}</text>`;
  }

  return { wrapSvg, hArrow, vArrow, iconAt, iconNode, pill, mutedLabel, theme };
}

async function verifyDiagramRaster(svgPath) {
  const png = await sharp(svgPath).png().toBuffer();
  if (png.length < 1000) {
    throw new Error(`${svgPath}: rasterized PNG looks empty (${png.length} bytes)`);
  }
  try {
    execSync(`xmllint --noout "${svgPath}"`, { stdio: "pipe" });
  } catch (err) {
    const msg = String(err?.stderr ?? err?.message ?? err);
    if (/xmllint: not found|ENOENT/i.test(msg)) {
      console.warn(`skip xmllint (not installed): ${svgPath}`);
    } else {
      throw err;
    }
  }
}

async function loadCoreIcons(themeName) {
  const githubFill = themeName === "dark" ? "#eef8fa" : "#1B1F23";
  const [amplify, cloudfront, github, git] = await Promise.all([
    fetchIcon(`amplify-${themeName}`, "icons/service/frontend/Arch_AWS-Amplify_64.svg", {
      base: AWS_ICONS_BASE,
      localRoot: localAws,
    }),
    fetchIcon(`cloudfront-${themeName}`, "icons/service/networking/Arch_Amazon-CloudFront_64.svg", {
      base: AWS_ICONS_BASE,
      localRoot: localAws,
    }),
    fetchIcon(`github-${themeName}`, "icons/github/Octicons-mark-github.svg", {
      base: ARCH_ICONS_BASE,
      localRoot: localArch,
      recolor: githubFill,
    }),
    fetchIcon(`git-${themeName}`, "icons/git/git-icon.svg", {
      base: ARCH_ICONS_BASE,
      localRoot: localArch,
    }),
  ]);
  return { amplify, cloudfront, github, git };
}

/** Amplify Hosting: Git is one option; this lab uses Git CD → Amplify → CDN. */
async function buildAmplifyHostingDiagram(theme) {
  const h = makeThemeHelpers(theme);
  const { amplify, cloudfront, github, git } = await loadCoreIcons(theme.name);

  const width = 980;
  const height = 420;
  const optionsY = 56;
  const optionsH = 118;
  const flowY = 214;
  const flowH = 170;

  const optW = (width - 48 - 24) / 3;
  const opts = [
    { title: "Git connected", sub: "this lab", active: true, icon: git },
    { title: "Manual upload", sub: "zip / drag-drop", active: false, icon: null },
    { title: "Other providers", sub: "Bitbucket · GitLab · …", active: false, icon: null },
  ];

  let optionsHtml = "";
  for (let i = 0; i < opts.length; i += 1) {
    const o = opts[i];
    const x = 24 + i * (optW + 12);
    const cx = x + optW / 2;
    const fill = o.active ? theme.goodFill : theme.panelFill;
    const stroke = o.active ? theme.accent : theme.panelStroke;
    optionsHtml += `
  <rect x="${x}" y="${optionsY}" width="${optW}" height="${optionsH}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${o.active ? 2 : 1}"/>
  <text x="${cx}" y="${optionsY + 28}" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="13" font-weight="600">${o.title}</text>
  <text x="${cx}" y="${optionsY + 48}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="11">${o.sub}</text>`;
    if (o.icon) {
      optionsHtml += `
  ${h.iconAt(o.icon, cx, optionsY + 58, 36)}`;
    } else {
      optionsHtml += `
  ${h.pill(cx, optionsY + 82, "supported", { fill: theme.pillFill })}`;
    }
    if (o.active) {
      optionsHtml += `
  <text x="${cx}" y="${optionsY + optionsH - 12}" text-anchor="middle" fill="${theme.accent}" font-family="sans-serif" font-size="11" font-weight="600">selected for this lab</text>`;
    }
  }

  const iconY = flowY + 36;
  const labelY = iconY + 68;
  const cxs = [120, 360, 600, 840];

  const content = `
  <text x="${width / 2}" y="34" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="16" font-weight="600">Amplify Hosting — deploy options</text>

  ${optionsHtml}

  <rect x="24" y="${flowY}" width="${width - 48}" height="${flowH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="40" y="${flowY + 26}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">This lab path</text>

  ${h.iconNode(github, cxs[0], iconY, labelY, "GitHub", "sample repo", 48)}
  ${h.hArrow(cxs[0] + 40, cxs[1] - 40, iconY + 24)}
  ${h.mutedLabel((cxs[0] + cxs[1]) / 2, iconY + 12, "push / PR", true)}
  ${h.iconNode(amplify, cxs[1], iconY, labelY, "Amplify", "amplify.yml build", 52)}
  ${h.hArrow(cxs[1] + 40, cxs[2] - 40, iconY + 24)}
  ${h.mutedLabel((cxs[1] + cxs[2]) / 2, iconY + 12, "publish", true)}
  ${h.iconNode(cloudfront, cxs[2], iconY, labelY, "CDN", "branch / PR URL", 48)}
  ${h.hArrow(cxs[2] + 40, cxs[3] - 50, iconY + 24)}
  ${h.pill(cxs[3], iconY + 24, "*.amplifyapp.com", {
    fill: theme.pillFill,
    stroke: theme.accent,
    ink: theme.title,
  })}
  ${h.mutedLabel(cxs[3], labelY + 8, "default hostname", true)}
  `;

  return h.wrapSvg(width, height, content);
}

/** Docs site vs sample app — two hosts. */
async function buildDocsVsSampleDiagram(theme) {
  const h = makeThemeHelpers(theme);
  const { amplify, github } = await loadCoreIcons(theme.name);

  const width = 980;
  const height = 280;
  const gap = 24;
  const panelY = 56;
  const panelH = height - panelY - 24;
  const leftX = 24;
  const leftW = (width - 48 - gap) / 2;
  const rightX = leftX + leftW + gap;
  const leftCx = leftX + leftW / 2;
  const rightCx = rightX + leftW / 2;
  const iconY = panelY + 40;
  const titleY = iconY + 68;
  const repoY = titleY + 20;
  const domainY = repoY + 20;

  const content = `
  <text x="${width / 2}" y="34" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="16" font-weight="600">Two repos — do not point Amplify at the docs</text>

  <rect x="${leftX}" y="${panelY}" width="${leftW}" height="${panelH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${leftX + 16}" y="${panelY + 24}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">Walkthrough (this site)</text>
  ${h.iconAt(github, leftCx, iconY, 52)}
  <text x="${leftCx}" y="${titleY}" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="13" font-weight="600">GitHub Pages</text>
  ${h.mutedLabel(leftCx, repoY, "amplify-astro-cicd-walkthrough", true)}
  ${h.mutedLabel(leftCx, domainY, "*.johna.kiwi", true)}

  <rect x="${rightX}" y="${panelY}" width="${leftW}" height="${panelH}" rx="12" fill="${theme.goodFill}" stroke="${theme.accent}" stroke-width="2"/>
  <text x="${rightX + 16}" y="${panelY + 24}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">Sample app (connect Amplify here)</text>
  ${h.iconAt(amplify, rightCx, iconY, 52)}
  <text x="${rightCx}" y="${titleY}" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="13" font-weight="600">Amplify Hosting</text>
  ${h.mutedLabel(rightCx, repoY, "amplify-astro-cicd", true)}
  ${h.mutedLabel(rightCx, domainY, "*.amplifyapp.com", true)}
  `;

  return h.wrapSvg(width, height, content);
}

/** Prefer GitHub App over pasting a PAT. */
async function buildGithubAppVsPatDiagram(theme) {
  const h = makeThemeHelpers(theme);
  const { amplify, github } = await loadCoreIcons(theme.name);

  const width = 980;
  const height = 320;
  const gap = 24;
  const panelY = 56;
  const panelH = height - panelY - 24;
  const leftX = 24;
  const leftW = (width - 48 - gap) / 2;
  const rightX = leftX + leftW + gap;
  const leftCx = leftX + leftW / 2;
  const rightCx = rightX + leftW / 2;
  const iconY = panelY + 56;
  const labelY = iconY + 68;

  const content = `
  <text x="${width / 2}" y="34" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="16" font-weight="600">How Amplify talks to GitHub</text>

  <rect x="${leftX}" y="${panelY}" width="${leftW}" height="${panelH}" rx="12" fill="${theme.goodFill}" stroke="${theme.goodStroke}" stroke-width="2"/>
  <text x="${leftX + 16}" y="${panelY + 26}" fill="${theme.accent}" font-family="sans-serif" font-size="12" font-weight="700">Prefer</text>
  ${h.iconNode(github, leftCx - 90, iconY, labelY, "GitHub App", "install on user / org", 48)}
  ${h.hArrow(leftCx - 40, leftCx + 40, iconY + 24)}
  ${h.iconNode(amplify, leftCx + 90, iconY, labelY, "Amplify", "clone + webhooks", 52)}
  ${h.pill(leftCx, panelY + panelH - 36, "no long-lived PAT", {
    fill: theme.pillFill,
    stroke: theme.goodStroke,
  })}

  <rect x="${rightX}" y="${panelY}" width="${leftW}" height="${panelH}" rx="12" fill="${theme.badFill}" stroke="${theme.badStroke}" stroke-width="2"/>
  <text x="${rightX + 16}" y="${panelY + 26}" fill="${theme.badStroke}" font-family="sans-serif" font-size="12" font-weight="700">Avoid</text>
  ${h.pill(rightCx - 90, iconY + 24, "classic PAT", {
    fill: theme.pillFill,
    stroke: theme.badStroke,
  })}
  ${h.hArrow(rightCx - 30, rightCx + 30, iconY + 24)}
  ${h.iconNode(amplify, rightCx + 90, iconY, labelY, "Amplify", "token stored", 52)}
  ${h.pill(rightCx, panelY + panelH - 36, "skip when App flow works", {
    fill: theme.pillFill,
    stroke: theme.badStroke,
  })}
  `;

  return h.wrapSvg(width, height, content);
}

/** Staging + PR previews promotion path. */
async function buildStagingPreviewsDiagram(theme) {
  const h = makeThemeHelpers(theme);
  const { amplify, github } = await loadCoreIcons(theme.name);

  const width = 980;
  const height = 520;
  const bandY = 52;
  const leftW = 280;
  const midW = 360;
  const rightW = 260;
  const gap = 16;
  const leftX = 24;
  const midX = leftX + leftW + gap;
  const rightX = midX + midW + gap;
  const bandH = height - bandY - 24;
  const midCx = midX + midW / 2;

  const cardW = 220;
  const cardH = 78;
  const cardX = midCx - cardW / 2;
  const cards = [
    {
      y: bandY + 48,
      title: "feature branch",
      url: "pr-N.…amplifyapp.com",
      life: "temporary",
      next: "merge PR",
    },
    {
      y: bandY + 190,
      title: "staging",
      url: "staging.…amplifyapp.com",
      life: "long-lived",
      next: "promote PR",
    },
    {
      y: bandY + 332,
      title: "main",
      url: "main.…amplifyapp.com",
      life: "long-lived",
      next: null,
    },
  ];

  let stageHtml = "";
  for (let i = 0; i < cards.length; i += 1) {
    const c = cards[i];
    stageHtml += `
  <rect x="${cardX}" y="${c.y}" width="${cardW}" height="${cardH}" rx="10" fill="${theme.pillFill}" stroke="${theme.accent}" stroke-width="1.5"/>
  <text x="${midCx}" y="${c.y + 26}" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="13" font-weight="600">${c.title}</text>
  <text x="${midCx}" y="${c.y + 46}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="11">${c.url}</text>
  <text x="${midCx}" y="${c.y + 64}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="11">${c.life}</text>`;
    if (c.next) {
      const arrowStart = c.y + cardH + 6;
      const arrowEnd = cards[i + 1].y - 6;
      const midY = (arrowStart + arrowEnd) / 2;
      stageHtml += `
  ${h.vArrow(midCx, arrowStart, arrowEnd)}
  <text x="${midCx + 18}" y="${midY + 4}" fill="${theme.muted}" font-family="sans-serif" font-size="11">${c.next}</text>`;
    }
  }

  const content = `
  <text x="${width / 2}" y="34" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="16" font-weight="600">Promotion path — staging then main</text>

  <rect x="${leftX}" y="${bandY}" width="${leftW}" height="${bandH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${leftX + 16}" y="${bandY + 26}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">Merge gate</text>
  ${h.iconNode(github, leftX + leftW / 2, bandY + 90, bandY + 160, "GitHub", "Actions + protection", 52)}
  ${h.pill(leftX + leftW / 2, bandY + 220, "CI must be green", { fill: theme.pillFill, stroke: theme.accent })}
  ${h.mutedLabel(leftX + leftW / 2, bandY + 270, "Amplify does not wait", true)}
  ${h.mutedLabel(leftX + leftW / 2, bandY + 288, "for checks — protect branches", true)}

  <rect x="${midX}" y="${bandY}" width="${midW}" height="${bandH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${midX + 16}" y="${bandY + 26}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">Environments</text>
  ${stageHtml}

  <rect x="${rightX}" y="${bandY}" width="${rightW}" height="${bandH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${rightX + 16}" y="${bandY + 26}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">Host</text>
  ${h.iconNode(amplify, rightX + rightW / 2, bandY + 110, bandY + 180, "Amplify", "build on push / PR", 56)}
  ${h.pill(rightX + rightW / 2, bandY + 240, "automatic or Console", { fill: theme.pillFill })}
  ${h.mutedLabel(rightX + rightW / 2, bandY + 290, "either cleans preview hosts", true)}
  ${h.mutedLabel(rightX + rightW / 2, bandY + 308, "neither deletes the app", true)}
  `;

  return h.wrapSvg(width, height, content);
}

/** Branch protection: PR + required checks; no direct push. */
async function buildBranchProtectionDiagram(theme) {
  const h = makeThemeHelpers(theme);
  const { github } = await loadCoreIcons(theme.name);

  const width = 980;
  const height = 420;
  const panelY = 56;
  const panelH = height - panelY - 24;
  const gap = 16;
  const leftW = 300;
  const midW = 340;
  const rightW = 270;
  const leftX = 24;
  const midX = leftX + leftW + gap;
  const rightX = midX + midW + gap;
  const footerY = panelY + panelH - 36;

  const checks = ["CI / build", "markdown-lint", "commitmsg-conform"];
  let checksHtml = "";
  for (let i = 0; i < checks.length; i += 1) {
    const y = panelY + 88 + i * 48;
    checksHtml += `
  ${h.pill(midX + midW / 2, y, checks[i], { fill: theme.pillFill, stroke: theme.accent })}`;
  }

  const content = `
  <text x="${width / 2}" y="34" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="16" font-weight="600">Branch protection on staging and main</text>

  <rect x="${leftX}" y="${panelY}" width="${leftW}" height="${panelH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${leftX + 16}" y="${panelY + 26}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">Allowed path</text>
  ${h.iconNode(github, leftX + leftW / 2, panelY + 48, panelY + 118, "Pull request", "only way to land", 48)}
  ${h.pill(leftX + leftW / 2, panelY + 178, "feature → staging", { fill: theme.pillFill, stroke: theme.goodStroke })}
  ${h.pill(leftX + leftW / 2, panelY + 230, "staging → main", { fill: theme.pillFill, stroke: theme.goodStroke })}
  ${h.mutedLabel(leftX + leftW / 2, footerY - 16, "wait for green checks", true)}
  ${h.mutedLabel(leftX + leftW / 2, footerY, "then merge", true)}

  <rect x="${midX}" y="${panelY}" width="${midW}" height="${panelH}" rx="12" fill="${theme.goodFill}" stroke="${theme.accent}" stroke-width="2"/>
  <text x="${midX + 16}" y="${panelY + 26}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">Required status checks</text>
  ${checksHtml}
  ${h.mutedLabel(midX + midW / 2, footerY, "must pass before merge", true)}

  <rect x="${rightX}" y="${panelY}" width="${rightW}" height="${panelH}" rx="12" fill="${theme.badFill}" stroke="${theme.badStroke}" stroke-width="2"/>
  <text x="${rightX + 16}" y="${panelY + 26}" fill="${theme.badStroke}" font-family="sans-serif" font-size="11" font-weight="600">Blocked</text>
  ${h.pill(rightX + rightW / 2, panelY + 100, "direct push", { fill: theme.pillFill, stroke: theme.badStroke })}
  ${h.pill(rightX + rightW / 2, panelY + 160, "force push", { fill: theme.pillFill, stroke: theme.badStroke })}
  ${h.pill(rightX + rightW / 2, panelY + 220, "merge with red CI", { fill: theme.pillFill, stroke: theme.badStroke })}
  ${h.mutedLabel(rightX + rightW / 2, footerY, "on staging and main", true)}
  `;

  return h.wrapSvg(width, height, content);
}

async function writeDiagramPair(baseName, build) {
  for (const theme of [THEMES.dark, THEMES.light]) {
    const svg = await build(theme);
    const suffix = theme.name === "dark" ? "" : "-light";
    const svgPath = join(publicDir, `${baseName}${suffix}.svg`);
    writeFileSync(svgPath, svg);
    await verifyDiagramRaster(svgPath);
    console.log(`Wrote ${svgPath}`);
  }
}

await writeDiagramPair("amplify-hosting-diagram", buildAmplifyHostingDiagram);
await writeDiagramPair("docs-vs-sample-diagram", buildDocsVsSampleDiagram);
await writeDiagramPair("github-app-vs-pat-diagram", buildGithubAppVsPatDiagram);
await writeDiagramPair("staging-previews-diagram", buildStagingPreviewsDiagram);
await writeDiagramPair("branch-protection-diagram", buildBranchProtectionDiagram);

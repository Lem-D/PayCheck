// Turns the web export into an app you can add to the iPhone home screen: icons, a manifest,
// full-screen mode and the app's colours. Run after `expo export --platform web`.
import fs from "node:fs";
import path from "node:path";

const dist = process.argv[2] ?? "dist";
const app = JSON.parse(fs.readFileSync(new URL("../app.json", import.meta.url))).expo;
const base = (app.experiments?.baseUrl ?? "").replace(/\/$/, "");
const light = "#f2f5fa";
const dark = "#0e1626";

const manifest = {
  name: "PayCheck",
  short_name: "PayCheck",
  start_url: `${base}/`,
  scope: `${base}/`,
  display: "standalone",
  background_color: light,
  theme_color: light,
  icons: [
    { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png" },
    { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png" },
    { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
fs.writeFileSync(path.join(dist, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));

const head = `
    <link rel="manifest" href="${base}/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="PayCheck" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="theme-color" content="${light}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${dark}" media="(prefers-color-scheme: dark)" />
    <style>
      html, body { background: ${light}; }
      @media (prefers-color-scheme: dark) { html, body { background: ${dark}; } }
    </style>
  </head>`;

const file = path.join(dist, "index.html");
let html = fs.readFileSync(file, "utf8");
// viewport-fit lets the tab bar clear the home indicator; maximum-scale stops Safari zooming into fields.
html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />');
html = html.replace(/<meta name="theme-color"[^>]*>\s*/, "");
html = html.replace("</head>", head);
fs.writeFileSync(file, html);
// GitHub Pages serves 404.html for unknown paths, so opening /goals directly still loads the app.
fs.writeFileSync(path.join(dist, "404.html"), html);
console.log(`Home screen app ready in ${dist} (served from ${base || "/"})`);

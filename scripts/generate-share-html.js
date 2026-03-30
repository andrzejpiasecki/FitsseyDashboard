const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const indexPath = path.join(distDir, "index.html");
const cssPath = path.join(distDir, "css", "style.css");
const appPath = path.join(distDir, "js", "app.js");
const iconPngPath = path.join(distDir, "icon.png");
const iconSvgPath = path.join(distDir, "icon.svg");
const outputPath = path.join(distDir, "dashboard-share.html");

for (const filePath of [indexPath, cssPath, appPath, iconPngPath, iconSvgPath]) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

let html = fs.readFileSync(indexPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const appJs = fs.readFileSync(appPath, "utf8");
const iconPngBase64 = fs.readFileSync(iconPngPath).toString("base64");
const iconSvgBase64 = fs.readFileSync(iconSvgPath).toString("base64");

const pngDataUri = `data:image/png;base64,${iconPngBase64}`;
const svgDataUri = `data:image/svg+xml;base64,${iconSvgBase64}`;

html = html
  .replace(/<link rel="stylesheet" href="css\/style\.css">/, `<style>${css}</style>`)
  .replace(/<link rel="icon" href="\/favicon\.ico" sizes="any">/, `<link rel="icon" href="${pngDataUri}" sizes="192x192">`)
  .replace(/<link rel="icon" href="\/icon\.svg" type="image\/svg\+xml">/, `<link rel="icon" href="${svgDataUri}" type="image/svg+xml">`)
  .replace(/<meta name="viewport" content="[^"]*">/, '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">')
  .replace(/\s*<div class="upload-wrap">[\s\S]*?<\/div>/, "")
  .replace(/<script[^>]*src="(?:\.\/)?js\/app\.js"[^>]*><\/script>/g, "")
  .replace(/<script[^>]*src="js\/app\.js"[^>]*><\/script>/g, "");

const mobileMeta = [
  '<meta name="theme-color" content="#635bff">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<meta name="apple-mobile-web-app-title" content="Reforma Dashboard">',
  `<link rel="apple-touch-icon" href="${pngDataUri}">`,
].join("");

html = html.replace("</head>", `${mobileMeta}</head>`);

const inlineAppScript = `<script>${appJs}<\/script>`;

html = html.replace("</body>", `${inlineAppScript}</body>`);

fs.writeFileSync(outputPath, html, "utf8");

console.log(`Generated ${path.relative(rootDir, outputPath)}`);

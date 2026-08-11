import fs from "node:fs";
import path from "node:path";

const outputDirectory = path.resolve("dist");
const sourceHtml = fs.readFileSync(path.join(outputDirectory, "index.html"), "utf8");
const scriptMatch = sourceHtml.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
const styleMatch = sourceHtml.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);

if (!scriptMatch || !styleMatch) {
  throw new Error("Vite output does not contain expected JS/CSS assets.");
}

const resolveAsset = (url) => path.join(outputDirectory, url.replace(/^\.?\//, ""));
const script = fs.readFileSync(resolveAsset(scriptMatch[1]), "utf8");
const style = fs.readFileSync(resolveAsset(styleMatch[1]), "utf8");
const singleHtml = sourceHtml
  .replace(styleMatch[0], `<style>${style}</style>`)
  .replace(scriptMatch[0], `<script type="module">${script}</script>`);

fs.writeFileSync(path.join(outputDirectory, "poolfix.html"), singleHtml);
console.log(`Created dist/poolfix.html (${Math.round(Buffer.byteLength(singleHtml) / 1024)} KiB)`);

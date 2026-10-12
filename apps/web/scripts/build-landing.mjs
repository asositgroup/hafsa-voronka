import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { transform } from "esbuild";

const root = new URL("..", import.meta.url).pathname;
const src = join(root, "landing");
const out = join(root, "public");
const outputs = ["index.html", "css", "js", "img"];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value.replace(/\/$/, "");
}

const apiUrl = required("NEXT_PUBLIC_API_URL");
const botUsername = required("NEXT_PUBLIC_BOT_USERNAME");
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "";

async function minifyCss(file) {
  const { code } = await transform(await readFile(join(src, "css", file), "utf8"), {
    loader: "css",
    minify: true,
    target: ["chrome100", "safari15"],
  });
  return code.trim();
}

async function minifyJs(file, define) {
  const { code } = await transform(await readFile(join(src, "js", file), "utf8"), {
    loader: "js",
    minify: true,
    target: ["chrome100", "safari15"],
    define,
  });
  return code;
}

await Promise.all(outputs.map((name) => rm(join(out, name), { recursive: true, force: true })));
await Promise.all(["css", "js", "img"].map((dir) => mkdir(join(out, dir), { recursive: true })));

const criticalCss = await minifyCss("critical.css");
let html = (await readFile(join(src, "index.html"), "utf8"))
  .replace("%%CRITICAL_CSS%%", () => criticalCss)
  .replaceAll("%%APP_URL%%", appUrl)
  .replaceAll("%%BOT_USERNAME%%", botUsername);
if (!pixelId) html = html.replace(/<script src="\.\/js\/pixel\.js" defer><\/script>\n?/, "");
html = html.replace(/>\s*\n\s*</g, "><").replace(/\n/g, "");

await writeFile(join(out, "index.html"), html);
await writeFile(join(out, "css", "main.css"), await minifyCss("main.css"));
await writeFile(
  join(out, "js", "main.js"),
  await minifyJs("main.js", {
    __API_URL__: JSON.stringify(apiUrl),
    __BOT_USERNAME__: JSON.stringify(botUsername),
  }),
);
if (pixelId) {
  await writeFile(join(out, "js", "pixel.js"), await minifyJs("pixel.js", { __FB_PIXEL_ID__: JSON.stringify(pixelId) }));
}
for (const file of await readdir(join(src, "img"))) {
  await copyFile(join(src, "img", file), join(out, "img", file));
}

const imageLimit = 10 * 1024;
const violations = [];
const check = (ok, rule) => ok || violations.push(rule);

check(/^<!doctype html><html lang="uz">/.test(html), "html must declare lang");
check(/<head>.*<style>.+<\/style>.*<\/head>/.test(html), "critical CSS must be inlined in <style>");
check(
  html.includes(
    `<link rel="stylesheet" href="./css/main.css" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="./css/main.css"></noscript>`,
  ),
  "main.css must load with the media=print swap and a noscript fallback",
);
for (const img of html.match(/<img [^>]*>/g) ?? []) {
  check(img.includes('loading="lazy"') && img.includes('decoding="async"'), `img needs loading=lazy decoding=async: ${img}`);
  for (const src of img.match(/\.\/img\/[^\s"]+/g) ?? []) check(src.endsWith(".avif"), `image must be AVIF: ${src}`);
}
for (const script of html.match(/<script[^>]*>/g) ?? []) check(/ defer[ >]/.test(script), `script needs defer: ${script}`);
check(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), "inline scripts are not allowed");
if (pixelId) check(html.endsWith('<script src="./js/pixel.js" defer></script></body></html>'), "Meta Pixel must be the last element");
for (const file of await readdir(join(out, "img"))) {
  const { size } = await stat(join(out, "img", file));
  check(size <= imageLimit, `img/${file} is ${size} B, limit ${imageLimit} B`);
}

if (violations.length) {
  console.error(`Landing breaks the launch rules:\n- ${violations.join("\n- ")}`);
  process.exit(1);
}

console.log(`Landing built for ${appUrl} (pixel ${pixelId ? "on" : "off"})`);

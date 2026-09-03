#!/usr/bin/env node
/* FOURWALLS inliner: baut aus einer .src.html eine selbsttragende .html
   - {{DATA}}            → Inhalt von data/properties.js
   - {{IMG:<key>}}       → data:image/jpeg;base64,... aus assets/web/<key>.jpg
   Usage: node tools/inline.js concepts/concept-01.src.html concepts/concept-01.html */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("Usage: node tools/inline.js <src.html> <out.html>"); process.exit(1); }
let html = fs.readFileSync(path.resolve(root, src), "utf8");
const data = fs.readFileSync(path.join(root, "data", "properties.js"), "utf8");
html = html.replace("{{DATA}}", () => data);
if (html.includes("{{LISTINGS}}")) {
  const listings = fs.readFileSync(path.join(root, "data", "listings.js"), "utf8");
  html = html.replace("{{LISTINGS}}", () => listings);
}
if (html.includes("{{CORE}}")) {
  const core = fs.readFileSync(path.join(root, "data", "portal-core.js"), "utf8");
  html = html.replace("{{CORE}}", () => core);
}
const used = new Set();
html = html.replace(/\{\{IMG:([a-z0-9-]+)\}\}/g, (_, key) => {
  used.add(key);
  const f = path.join(root, "assets", "web", key + ".jpg");
  if (!fs.existsSync(f)) { console.error("MISSING IMAGE: " + key); process.exit(2); }
  return "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64");
});
html = html.replace(/\{\{PNG:([a-z0-9-]+)\}\}/g, (_, key) => {
  used.add(key + ".png");
  const f = path.join(root, "assets", key + ".png");
  if (!fs.existsSync(f)) { console.error("MISSING PNG: " + key); process.exit(2); }
  return "data:image/png;base64," + fs.readFileSync(f).toString("base64");
});
if (/\{\{(DATA|IMG:|PNG:|LISTINGS|CORE)/.test(html)) { console.error("Unresolved placeholders remain"); process.exit(3); }
fs.writeFileSync(path.resolve(root, out), html);
const mb = (fs.statSync(path.resolve(root, out)).size / 1048576).toFixed(2);
console.log("OK " + out + " (" + mb + " MB, images: " + [...used].join(", ") + ")");
if (mb > 15) { console.error("WARNING: exceeds 15 MB artifact budget"); process.exit(4); }

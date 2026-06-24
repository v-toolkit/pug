"use strict";

/*
  scripts/build-manifest.js
  -------------------------
  Builds examples/manifest.json and copies the country example XML out of the
  committed puf-billing submodule into the publish folder, so the web app can
  load examples SAME-ORIGIN from its own Pages site — no GitHub API, no
  raw.githubusercontent, no rate limits.

  Usage:
    node scripts/build-manifest.js [--src <submodule>] [--out <dir>]

  Defaults: --src reference/puf-billing   --out examples
  In CI, point --out at the publish dir, e.g.:
    node scripts/build-manifest.js --out _site/examples

  Output layout (under --out):
    manifest.json
    country-specific-examples/<folder>/<file>.xml ...

  The manifest maps each country folder to its example files with RELATIVE
  hrefs (e.g. "examples/country-specific-examples/france/PUF_France_Generic_Invoice.xml"),
  which resolve correctly under a project subpath like /pug/.
*/

const fs = require("fs");
const path = require("path");

function arg(name, def) {
    const i = process.argv.indexOf(name);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const SRC = arg("--src", path.join("reference", "puf-billing"));
const OUT = arg("--out", "examples");
const REL = path.join("examples", "country-specific-examples");
const srcExamples = path.join(SRC, REL);

if (!fs.existsSync(srcExamples)) {
    console.error("Examples not found at: " + srcExamples);
    console.error("Is the submodule checked out?  git submodule update --init --recursive");
    process.exit(1);
}

// Encode each path segment but keep the slashes (handles spaces in names).
function encPath(rel) {
    return rel.split("/").map(encodeURIComponent).join("/");
}

// "PUF_France_Generic_Invoice.xml" -> "Generic Invoice" (drops PUF + country words).
function labelFor(folder, file) {
    let base = file.replace(/\.xml$/i, "").replace(/^PUF[_-]?/i, "");
    const countryWords = folder.split(/[-\s_]+/).filter(Boolean).map(w => w.toLowerCase());
    let toks = base.split(/[_\s]+/).filter(Boolean);
    while (toks.length > 1 && countryWords.indexOf(toks[0].toLowerCase()) >= 0) toks.shift();
    const label = toks.join(" ").trim();
    return label || base;
}

function kindFor(file) {
    return /credit\s*note|creditnote/i.test(file) ? "creditnote" : "invoice";
}

// Collect *.xml at any depth under a country folder, as paths relative to it.
function walkXml(dir, rel) {
    let out = [];
    fs.readdirSync(dir).sort().forEach(function (name) {
        const full = path.join(dir, name);
        const r = rel ? rel + "/" + name : name;
        if (fs.statSync(full).isDirectory()) out = out.concat(walkXml(full, r));
        else if (/\.xml$/i.test(name)) out.push(r);
    });
    return out;
}

const folders = {};
let fileCount = 0;

fs.readdirSync(srcExamples).sort().forEach(function (folder) {
    const dir = path.join(srcExamples, folder);
    if (!fs.statSync(dir).isDirectory()) return;
    const rels = walkXml(dir, "");
    if (!rels.length) return;

    const entries = [];
    rels.forEach(function (rel) {
        const parts = rel.split("/");
        const fileName = parts[parts.length - 1];
        const subdir = parts.slice(0, -1).join("/");
        const clean = labelFor(folder, fileName);
        const destPath = path.join(OUT, "country-specific-examples", folder, rel);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(path.join(dir, rel), destPath);
        entries.push({
            file: rel,
            label: subdir ? (subdir + " / " + clean) : clean,
            kind: kindFor(fileName),
            href: "examples/" + encPath("country-specific-examples/" + folder + "/" + rel)
        });
        fileCount++;
    });
    folders[folder] = entries;
});

fs.mkdirSync(OUT, { recursive: true });
const manifest = {
    source: "pagero/puf-billing (committed submodule)",
    builtAt: new Date().toISOString(),
    folderCount: Object.keys(folders).length,
    fileCount: fileCount,
    folders: folders
};
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log("Wrote " + path.join(OUT, "manifest.json") +
    " — " + manifest.folderCount + " folders, " + fileCount + " files; copied XML into " +
    path.join(OUT, "country-specific-examples") + "/");
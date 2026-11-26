#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/bump-version.mjs <x.y.z>");
  process.exit(1);
}

const root = process.cwd();

function replaceInFile(relPath, pattern, replacement) {
  const fullPath = path.join(root, relPath);
  const content = fs.readFileSync(fullPath, "utf8");
  if (!pattern.test(content)) {
    throw new Error(`Pattern not found in ${relPath}`);
  }
  const updated = content.replace(pattern, replacement);
  fs.writeFileSync(fullPath, updated, "utf8");
  console.log(`Updated ${relPath} -> ${version}`);
}

replaceInFile("package.json", /"version":\s*"[^"]+"/, `"version": "${version}"`);
replaceInFile("src-tauri/Cargo.toml", /^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
replaceInFile("src-tauri/tauri.conf.json", /"version":\s*"[^"]+"/, `"version": "${version}"`);
replaceInFile("src/utils/version.ts", /export const APP_VERSION = "[^"]+";/, `export const APP_VERSION = "${version}";`);
replaceInFile("tests/settings_external.test.mjs", /assert\.equal\(APP_VERSION,\s*"[^"]+"\);/, `assert.equal(APP_VERSION, "${version}");`);

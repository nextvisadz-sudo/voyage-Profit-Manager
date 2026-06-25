/**
 * Script to download and install Windows native module binaries
 * that were excluded from the pnpm workspace (Replit/Linux-only setup).
 * Run: node install-win-binaries.mjs
 */

import https from "https";
import fs from "fs";
import path from "path";
import { createGunzip } from "zlib";
import { execSync } from "child_process";

const CWD = process.cwd();

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`  Downloading: ${url}`);
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { "User-Agent": "node/24" } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // Follow redirect
        file.close();
        fs.unlinkSync(dest);
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", reject);
    }).on("error", reject);
  });
}

async function getLatestVersionOfPackage(pkg) {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${pkg}/latest`;
    https.get(url, { headers: { "User-Agent": "node/24", "Accept": "application/json" } }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data).version);
        } catch(e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function getNpmTarballUrl(pkg, version) {
  return new Promise((resolve, reject) => {
    const encodedPkg = pkg.replace("/", "%2F").replace("@", "%40");
    const url = `https://registry.npmjs.org/${pkg}/${version}`;
    https.get(url, { headers: { "User-Agent": "node/24", "Accept": "application/json" } }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const info = JSON.parse(data);
          resolve(info.dist.tarball);
        } catch(e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function extractTarball(tarballPath, destDir) {
  // Use Node.js built-in to extract
  fs.mkdirSync(destDir, { recursive: true });
  
  // Try using tar (available on Windows 10+)
  try {
    execSync(`tar -xzf "${tarballPath}" -C "${destDir}" --strip-components=1`, { stdio: "pipe" });
    return;
  } catch(e) {
    console.log("  tar failed, trying alternative...");
  }
  
  // Try using PowerShell
  try {
    execSync(`powershell -Command "& { Add-Type -AssemblyName System.IO.Compression.FileSystem; $tar = [System.IO.Compression.ZipFile]; }"`, { stdio: "pipe" });
  } catch(e) {
    // ignore
  }
}

async function installNativeModule(pkg, version, targetDir) {
  const tmpFile = path.join(CWD, `_tmp_${pkg.replace(/[@\/]/g, "_")}.tgz`);
  
  try {
    console.log(`\nInstalling ${pkg}@${version}...`);
    const tarballUrl = await getNpmTarballUrl(pkg, version);
    await downloadFile(tarballUrl, tmpFile);
    console.log(`  Extracting to ${targetDir}...`);
    fs.mkdirSync(targetDir, { recursive: true });
    execSync(`tar -xzf "${tmpFile}" -C "${targetDir}" --strip-components=1`, { stdio: "inherit" });
    console.log(`  ✓ Installed ${pkg}`);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

async function main() {
  console.log("Installing Windows native module binaries...\n");

  const lightningcssDir = path.join(CWD, "node_modules/.pnpm/lightningcss@1.32.0/node_modules/lightningcss-win32-x64-msvc");
  const rollupDir = path.join(CWD, "node_modules/.pnpm/rollup@4.60.3/node_modules/@rollup/rollup-win32-x64-msvc");
  const oxideDir = path.join(CWD, "node_modules/.pnpm/@tailwindcss+oxide@4.3.0/node_modules/@tailwindcss/oxide-win32-x64-msvc");
  
  // Install lightningcss-win32-x64-msvc
  if (!fs.existsSync(lightningcssDir)) {
    await installNativeModule("lightningcss-win32-x64-msvc", "1.32.0", lightningcssDir);
  } else {
    console.log("lightningcss-win32-x64-msvc already installed");
  }
  
  // Install @rollup/rollup-win32-x64-msvc
  if (!fs.existsSync(rollupDir)) {
    await installNativeModule("@rollup/rollup-win32-x64-msvc", "4.60.3", rollupDir);
  } else {
    console.log("@rollup/rollup-win32-x64-msvc already installed");
  }

  // Install @tailwindcss/oxide-win32-x64-msvc
  if (!fs.existsSync(oxideDir)) {
    await installNativeModule("@tailwindcss/oxide-win32-x64-msvc", "4.3.0", oxideDir);
  } else {
    console.log("@tailwindcss/oxide-win32-x64-msvc already installed");
  }
  
  console.log("\n✅ All Windows native modules installed!");
  console.log("\nYou can now run:");
  console.log("  node mock-api-server.mjs   (in one terminal)");
  console.log("  pnpm --filter @workspace/travel-website run dev  (in another)");
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});

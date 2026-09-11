import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const STAGING_DIR = path.join(ROOT_DIR, 'dist-ota');

console.log('🚀 Building production web bundle...');
execSync('npm run build', { stdio: 'inherit' });

console.log('📦 Preparing lightweight OTA bundle (excluding APK binary)...');
if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

function copyFiltered(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory() && entry.name.toLowerCase() === 'downloads') {
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.apk')) {
      continue;
    }

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyFiltered(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyFiltered(DIST_DIR, STAGING_DIR);

const extraArgs = process.argv.slice(2).join(' ');
const hasBundleArg = extraArgs.includes('--bundle') || extraArgs.includes('-b') || extraArgs.includes('--auto-bump');
const bundleFlag = hasBundleArg ? '' : '--auto-bump';
const uploadCmd = `npx @capgo/cli bundle upload com.vku.field.survey.vku.field.survey --path ./dist-ota --channel production ${bundleFlag} ${extraArgs}`.trim();

console.log(`📤 Uploading OTA bundle to Capgo Cloud:\n   ${uploadCmd}`);
try {
  execSync(uploadCmd, { stdio: 'inherit' });
  console.log('✅ Capgo OTA upload complete!');
} finally {
  if (fs.existsSync(STAGING_DIR)) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }
}

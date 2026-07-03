const fs = require('fs');
const path = require('path');

const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');

// 复制 public/
const publicSrc = path.join(__dirname, '..', 'public');
const publicDst = path.join(standaloneDir, 'public');
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDst, { recursive: true, force: true });
  console.log('✓ Copied public/ to standalone');
} else {
  console.log('! No public/ directory found, skipping');
}

// 复制 .next/static/
const staticSrc = path.join(__dirname, '..', '.next', 'static');
const staticDst = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  fs.cpSync(staticSrc, staticDst, { recursive: true, force: true });
  console.log('✓ Copied .next/static/ to standalone');
} else {
  console.log('! No .next/static/ found, skipping');
}

// 复制编译后的 electron/*.js 到 standalone 根目录
const electronSrcDir = path.join(__dirname, '..', 'electron-out');
const electronFiles = ['main.js', 'preload.js'];
for (const f of electronFiles) {
  const src = path.join(electronSrcDir, f);
  const dst = path.join(standaloneDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`✓ Copied electron-out/${f} to standalone`);
  }
}

console.log('✓ Standalone directory ready at', standaloneDir);

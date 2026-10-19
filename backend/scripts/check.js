const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function jsFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(folder, entry.name);
    return entry.isDirectory() ? jsFiles(target) : target.endsWith('.js') ? [target] : [];
  });
}

for (const file of [...jsFiles(path.join(__dirname, '../src')), ...jsFiles(path.join(__dirname, '../scripts')), ...jsFiles(path.join(__dirname, '../tests'))]) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Tất cả file JavaScript đều hợp lệ về cú pháp.');

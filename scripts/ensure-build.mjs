import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const index = path.join(root, 'web', 'dist', 'index.html');

if (fs.existsSync(index)) {
  process.exit(0);
}

console.log('→ Interface non compilée détectée, compilation en cours…');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

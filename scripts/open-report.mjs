import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { exec } from 'node:child_process';
const file = resolve('reports/sdlc-report/index.html');
if (!existsSync(file)) { console.error('No report yet. Run: npm test'); process.exit(1); }
const cmd = process.platform === 'win32' ? `start "" "${file}"` : process.platform === 'darwin' ? `open "${file}"` : `xdg-open "${file}"`;
exec(cmd); console.log('Opened', file);

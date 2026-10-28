import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.resolve(rootDir, 'apps/web/dist');
const destDir = path.resolve(rootDir, 'dist');

try {
  if (fs.existsSync(srcDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(srcDir, destDir, { recursive: true, force: true });
    console.log(`[copy-dist] Successfully copied build output from ${srcDir} to ${destDir}`);
  } else {
    console.warn(`[copy-dist] Warning: ${srcDir} does not exist.`);
  }
} catch (error) {
  console.error('[copy-dist] Failed to copy build output:', error);
}

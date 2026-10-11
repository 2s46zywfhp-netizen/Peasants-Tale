// npm run e2e: build, serve the production build, and run the browser checks and the screenshot pass.
// SHOTS=docs/screenshots/ writes the screenshots there (default: a scratch folder).
import { execSync, spawn } from 'node:child_process';
execSync('npm run build', { stdio: 'inherit' });
const server = spawn('npx', ['vite', 'preview', '--port', '4178', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
let code = 0;
try {
  const url = 'http://localhost:4178/';
  execSync(`node e2e/verify.mjs ${url}`, { stdio: 'inherit' });
  execSync(`node e2e/screenshots.mjs ${url} ${process.env.SHOTS ?? '/tmp/peasant-shots/'}`, { stdio: 'inherit' });
} catch {
  code = 1;
} finally {
  server.kill();
}
process.exit(code);

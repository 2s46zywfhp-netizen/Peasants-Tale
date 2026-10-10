import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/** Emits dist/sw.js precaching every built asset and every public file, for full offline play. */
function precacheServiceWorker(): Plugin {
  return {
    name: 'precache-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const hash = createHash('sha256');
      const urls = new Set<string>(['/']);
      for (const [name, chunk] of Object.entries(bundle)) {
        if (name.endsWith('.map')) continue;
        urls.add(`/${name}`);
        hash.update(name);
        hash.update(chunk.type === 'chunk' ? chunk.code : typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source));
      }
      const pub = join(process.cwd(), 'public');
      for (const file of listFiles(pub)) {
        urls.add(`/${relative(pub, file).split(sep).join('/')}`);
        hash.update(readFileSync(file));
      }
      const template = readFileSync(join(process.cwd(), 'scripts', 'sw-template.js'), 'utf8');
      const source = template
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify([...urls].sort(), null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [precacheServiceWorker()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
});

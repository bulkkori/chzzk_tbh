import esbuild from 'esbuild';
import { readFileSync } from 'fs';

// package.json에서 의존성 목록을 가져옵니다.
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

esbuild.build({
  entryPoints: ['api/index.ts'], // 진입점 확인 (api/index.ts 또는 src/app.ts)
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.mjs',
  // ★ 핵심: @workspace로 시작하는 패키지는 외부(external)로 빼지 말고 하나로 합칩니다.
  external: Object.keys(pkg.dependencies || {}).filter(
    (dep) => !dep.startsWith('@workspace/')
  ),
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  sourcemap: true,
}).catch(() => process.exit(1));

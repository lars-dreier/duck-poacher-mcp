import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts', 'src/cli.ts'],
	format: ['esm'],
	unbundle: true,
	dts: true,
	sourcemap: false,
	clean: true,
	target: 'node18',
	outDir: 'dist'
});

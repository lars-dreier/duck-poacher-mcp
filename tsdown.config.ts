import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/cli.ts'],
	format: ['esm'],
	unbundle: true,
	dts: false,
	sourcemap: false,
	clean: true,
	target: 'node18',
	outDir: 'dist'
});

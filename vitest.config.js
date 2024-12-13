import { defineConfig } from 'vitest/config';

export default defineConfig({
	define: {
		DEBUG: 'true'
	},
	test: {
		environment: 'node',
	}
});

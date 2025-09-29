// @ts-check
import { defineConfig } from 'astro/config';
import path from 'path';
import { fileURLToPath } from 'url';
import cloudflare from '@astrojs/cloudflare';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    ssr: {
      external: ['zlib-sync'],
    },
  },
});

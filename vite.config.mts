import { defineConfig } from 'vite';
import { defaultViteConfig } from 'markedit-vite';
import pkg from './package.json';

export default defineConfig({
  ...defaultViteConfig(),
  define: {
    __EXTENSION_VERSION__: JSON.stringify(pkg.version),
  },
});

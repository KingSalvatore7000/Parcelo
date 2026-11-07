import { defineConfig, type Plugin, type Connect } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The intro page is a static page in public/welcome/. Vite's dev and preview servers would
 * answer /welcome and /welcome/ with the React app (SPA fallback), so point them at its file.
 */
function welcomePage(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url) {
      const [path, query] = req.url.split('?');
      const qs = query ? `?${query}` : '';
      if (path === '/welcome') {
        // The page loads its kit with relative paths (assets/...), so it needs the trailing slash
        res.statusCode = 301;
        res.setHeader('Location', `/welcome/${qs}`);
        res.end();
        return;
      }
      if (path === '/welcome/') req.url = `/welcome/index.html${qs}`;
    }
    next();
  };
  return {
    name: 'parcelo-welcome-page',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [welcomePage(), react()],
  server: {
    port: 5173,
    host: true, // Listen on all network interfaces (for tablets / mobile testing)
  },
});

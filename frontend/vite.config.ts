import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from "vite";

// Plugin to handle Chrome DevTools well-known requests
function chromeDevToolsPlugin(): Plugin {
  return {
    name: "chrome-devtools-handler",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/.well-known/appspecific/")) {
          res.statusCode = 204;
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [chromeDevToolsPlugin(), tailwindcss(), reactRouter(), tsconfigPaths()],
});

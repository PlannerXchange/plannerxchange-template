import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = dirname(fileURLToPath(import.meta.url));
const pluginSourcePath = "src/plugin.tsx";

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function plannerXchangePublishManifestPlugin(): Plugin {
  return {
    name: "plannerxchange-publish-manifest",
    generateBundle(_, bundle) {
      const pluginEntryChunk = Object.values(bundle).find(
        (entry): entry is Extract<(typeof bundle)[string], { type: "chunk" }> =>
          entry.type === "chunk" &&
          entry.isEntry &&
          typeof entry.facadeModuleId === "string" &&
            normalizeRelativePath(entry.facadeModuleId).endsWith(`/${pluginSourcePath}`)
      );

      if (!pluginEntryChunk) {
        throw new Error(`Unable to find built output for ${pluginSourcePath}.`);
      }

      this.emitFile({
        type: "asset",
        fileName: "plannerxchange.publish.json",
        source: `${JSON.stringify(
          {
            schemaVersion: 1,
            entryPoints: {
              [pluginSourcePath]: {
                file: pluginEntryChunk.fileName,
                css: pluginEntryChunk.viteMetadata?.importedCss
                  ? [...pluginEntryChunk.viteMetadata.importedCss]
                  : []
              }
            }
          },
          null,
          2
        )}\n`
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), plannerXchangePublishManifestPlugin()],
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        preview: resolve(rootDir, "index.html"),
        plugin: resolve(rootDir, pluginSourcePath)
      },
      output: {
        preserveEntrySignatures: "exports-only"
      }
    }
  }
});

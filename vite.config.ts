import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = dirname(fileURLToPath(import.meta.url));
const pluginSourcePath = "src/plugin.tsx";
const buildProvenancePath = "plannerxchange.build-provenance.json";

interface FileDigest {
  path: string;
  sha256: string;
  sizeBytes: number;
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function sha256Hex(body: string | Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function createFileDigest(path: string, body: string | Uint8Array): FileDigest {
  const buffer = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);

  return {
    path,
    sha256: sha256Hex(buffer),
    sizeBytes: buffer.length
  };
}

function sortFileDigests(files: FileDigest[]): FileDigest[] {
  return files
    .map((file) => ({
      path: file.path,
      sha256: file.sha256,
      sizeBytes: file.sizeBytes
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function buildAggregateDigest(files: FileDigest[]): string {
  const hash = createHash("sha256");

  for (const file of sortFileDigests(files)) {
    hash.update(file.path, "utf8");
    hash.update("\0", "utf8");
    hash.update(file.sha256, "utf8");
    hash.update("\0", "utf8");
    hash.update(String(file.sizeBytes), "utf8");
    hash.update("\n", "utf8");
  }

  return hash.digest("hex");
}

function isDependencyLockfilePath(filePath: string): boolean {
  const fileName = filePath.slice(filePath.lastIndexOf("/") + 1);

  return (
    fileName === "package-lock.json" ||
    fileName === "npm-shrinkwrap.json" ||
    fileName === "yarn.lock" ||
    fileName === "pnpm-lock.yaml" ||
    fileName === "bun.lock" ||
    fileName === "bun.lockb"
  );
}

function isBuildInputPath(filePath: string): boolean {
  const fileName = filePath.slice(filePath.lastIndexOf("/") + 1);

  if (
    filePath.startsWith("dist/") ||
    filePath.startsWith("node_modules/") ||
    filePath.startsWith(".git/") ||
    filePath.startsWith("build/") ||
    filePath.startsWith("coverage/")
  ) {
    return false;
  }

  return (
    filePath === "plannerxchange.app.json" ||
    filePath === "package.json" ||
    isDependencyLockfilePath(filePath) ||
    fileName === "index.html" ||
    fileName === "tsconfig.json" ||
    fileName.startsWith("vite.config.") ||
    filePath.startsWith("src/") ||
    filePath.startsWith("public/")
  );
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relPath = normalizeRelativePath(relative(rootDir, fullPath));

    if (
      relPath === ".git" ||
      relPath === "node_modules" ||
      relPath === "dist" ||
      relPath === "build" ||
      relPath === "coverage"
    ) {
      continue;
    }

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function readBuildInputDigests(): FileDigest[] {
  return sortFileDigests(
    walkFiles(rootDir)
      .map((filePath) => ({
        fullPath: filePath,
        relPath: normalizeRelativePath(relative(rootDir, filePath))
      }))
      .filter((file) => isBuildInputPath(file.relPath))
      .map((file) => createFileDigest(file.relPath, readFileSync(file.fullPath)))
  );
}

function readLockfileDigests(): FileDigest[] {
  return sortFileDigests(
    ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"]
      .filter((filePath) => existsSync(resolve(rootDir, filePath)))
      .map((filePath) => createFileDigest(filePath, readFileSync(resolve(rootDir, filePath))))
  );
}

function walkOutputFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...walkOutputFiles(fullPath));
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function readDistArtifactDigests(outputDir: string): FileDigest[] {
  return sortFileDigests(
    walkOutputFiles(outputDir)
      .map((filePath) => ({
        fullPath: filePath,
        relPath: normalizeRelativePath(relative(rootDir, filePath))
      }))
      .filter((file) => file.relPath !== `dist/${buildProvenancePath}`)
      .map((file) => createFileDigest(file.relPath, readFileSync(file.fullPath)))
  );
}

function inferPackageManager(lockfileDigests: FileDigest[]): "npm" | "yarn" | "pnpm" | "bun" | "unknown" {
  const paths = new Set(lockfileDigests.map((file) => file.path));

  if (paths.has("package-lock.json") || paths.has("npm-shrinkwrap.json")) {
    return "npm";
  }

  if (paths.has("pnpm-lock.yaml")) {
    return "pnpm";
  }

  if (paths.has("yarn.lock")) {
    return "yarn";
  }

  if (paths.has("bun.lock") || paths.has("bun.lockb")) {
    return "bun";
  }

  return "unknown";
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

      const publishManifestSource = `${JSON.stringify(
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
      )}\n`;

      this.emitFile({
        type: "asset",
        fileName: "plannerxchange.publish.json",
        source: publishManifestSource
      });

    },
    writeBundle(options) {
      const outputDir = options.dir ? resolve(rootDir, options.dir) : resolve(rootDir, "dist");
      const artifactDigests = readDistArtifactDigests(outputDir);
      const lockfileDigests = readLockfileDigests();
      const sourceInputDigests = readBuildInputDigests();
      const buildProvenanceSource = `${JSON.stringify(
        {
          schemaVersion: "build_provenance_v1",
          sourceInputDigest: buildAggregateDigest(sourceInputDigests),
          buildCommand: "npm run build",
          packageManager: inferPackageManager(lockfileDigests),
          nodeVersion: process.version,
          builder: {
            name: "plannerxchange-template-vite-plugin"
          },
          aggregateArtifactDigest: buildAggregateDigest(artifactDigests),
          dependencyLockfileDigests: lockfileDigests,
          files: artifactDigests
        },
        null,
        2
      )}\n`;

      writeFileSync(join(outputDir, buildProvenancePath), buildProvenanceSource);
    }
  };
}

export default defineConfig({
  plugins: [react(), plannerXchangePublishManifestPlugin()],
  // Note: Vite defaults to port 5173. Do not change this — PlannerXchange's dev
  // environment allows CORS and Cognito auth callbacks from localhost:5173.
  build: {
    manifest: true,
    // Use terser instead of esbuild to preserve export names.
    // esbuild's minification renames exports (e.g. "mount" -> "m") which breaks
    // the shell's dynamic plugin loading.
    minify: "terser",
    terserOptions: {
      mangle: {
        // Preserve required export names so the shell can find them.
        reserved: ["mount", "pluginModule", "manifest"]
      }
    },
    rollupOptions: {
      input: {
        preview: resolve(rootDir, "index.html"),
        plugin: resolve(rootDir, pluginSourcePath)
      },
      // preserveEntrySignatures is required so Rollup keeps the `mount` export
      // on the plugin chunk instead of tree-shaking or re-routing it.
      preserveEntrySignatures: "exports-only"
    }
  }
});

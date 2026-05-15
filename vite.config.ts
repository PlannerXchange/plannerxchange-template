import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = dirname(fileURLToPath(import.meta.url));
const manifestPath = "plannerxchange.app.json";
const publishManifestFileName = "plannerxchange.publish.json";
const buildProvenanceFileName = "plannerxchange.build-provenance.json";

interface PlannerXchangeManifestDraft {
  entryPoint?: unknown;
  appRoot?: unknown;
  distRoot?: unknown;
  workspacePackage?: unknown;
}

interface FileDigest {
  path: string;
  sha256: string;
  sizeBytes: number;
}

interface AppBoundary {
  appRoot: string;
  distRoot: string;
  workspacePackage: string | null;
  entryPoint: string;
  pluginSourcePath: string;
  buildProvenancePath: string;
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function normalizeRepoRelativePath(value: unknown, fallback: string): string {
  const rawValue = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const normalized = normalizeRelativePath(rawValue)
    .replace(/^\.\/+/, "")
    .replace(/^\/+|\/+$/g, "");

  if (!normalized || normalized === ".") {
    return ".";
  }

  if (
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.endsWith("/..") ||
    /^[a-z]:\//i.test(normalized)
  ) {
    throw new Error(`PlannerXchange path '${rawValue}' must be a repo-relative path inside the repository.`);
  }

  return normalized;
}

function joinRepoRelativePath(base: string, child: string): string {
  const normalizedChild = normalizeRepoRelativePath(child, ".");

  if (normalizedChild === ".") {
    return base;
  }

  return base === "." ? normalizedChild : `${base}/${normalizedChild}`;
}

function isPathWithin(filePath: string, rootPath: string): boolean {
  return filePath === rootPath || filePath.startsWith(`${rootPath.replace(/\/+$/, "")}/`);
}

function readPlannerXchangeManifest(): PlannerXchangeManifestDraft {
  const fullManifestPath = resolve(rootDir, manifestPath);

  if (!existsSync(fullManifestPath)) {
    throw new Error(`${manifestPath} is required at the repository root.`);
  }

  return JSON.parse(readFileSync(fullManifestPath, "utf8")) as PlannerXchangeManifestDraft;
}

function resolveAppBoundary(): AppBoundary {
  const manifest = readPlannerXchangeManifest();
  const appRoot = normalizeRepoRelativePath(manifest.appRoot, ".");
  const defaultDistRoot = appRoot === "." ? "dist" : `${appRoot}/dist`;
  const distRoot = normalizeRepoRelativePath(manifest.distRoot, defaultDistRoot);
  const entryPoint = normalizeRepoRelativePath(manifest.entryPoint, "src/plugin.tsx");
  const workspacePackage =
    typeof manifest.workspacePackage === "string" && manifest.workspacePackage.trim()
      ? manifest.workspacePackage.trim()
      : null;
  const pluginSourcePath = joinRepoRelativePath(appRoot, entryPoint);

  return {
    appRoot,
    distRoot,
    workspacePackage,
    entryPoint,
    pluginSourcePath,
    buildProvenancePath: `${distRoot}/${buildProvenanceFileName}`
  };
}

const appBoundary = resolveAppBoundary();

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
    isPathWithin(filePath, appBoundary.distRoot) ||
    filePath.startsWith("node_modules/") ||
    filePath.startsWith(".git/") ||
    filePath.startsWith("build/") ||
    filePath.startsWith("coverage/")
  ) {
    return false;
  }

  return (
    filePath === manifestPath ||
    filePath === "package.json" ||
    isDependencyLockfilePath(filePath) ||
    fileName === "index.html" ||
    fileName === "tsconfig.json" ||
    fileName.startsWith("vite.config.") ||
    isPathWithin(filePath, joinRepoRelativePath(appBoundary.appRoot, "src")) ||
    isPathWithin(filePath, joinRepoRelativePath(appBoundary.appRoot, "public")) ||
    filePath === joinRepoRelativePath(appBoundary.appRoot, "package.json") ||
    filePath === joinRepoRelativePath(appBoundary.appRoot, "tsconfig.json") ||
    isDependencyLockfilePath(filePath.slice(appBoundary.appRoot === "." ? 0 : appBoundary.appRoot.length + 1))
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
      isPathWithin(relPath, appBoundary.distRoot) ||
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
  const candidatePaths = new Set<string>();

  for (const filePath of ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"]) {
    candidatePaths.add(filePath);

    if (appBoundary.appRoot !== ".") {
      candidatePaths.add(joinRepoRelativePath(appBoundary.appRoot, filePath));
    }
  }

  return sortFileDigests(
    [...candidatePaths]
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
      .filter((file) => file.relPath !== appBoundary.buildProvenancePath)
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
            normalizeRelativePath(entry.facadeModuleId).endsWith(`/${appBoundary.pluginSourcePath}`)
      );

      if (!pluginEntryChunk) {
        throw new Error(`Unable to find built output for ${appBoundary.pluginSourcePath}.`);
      }

      const publishManifestSource = `${JSON.stringify(
        {
          schemaVersion: 1,
          appRoot: appBoundary.appRoot,
          distRoot: appBoundary.distRoot,
          workspacePackage: appBoundary.workspacePackage,
          entryPoints: {
            [appBoundary.entryPoint]: {
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
        fileName: publishManifestFileName,
        source: publishManifestSource
      });

    },
    writeBundle(options) {
      const outputDir = options.dir ? resolve(rootDir, options.dir) : resolve(rootDir, "dist");
      const artifactDigests = readDistArtifactDigests(outputDir);
      const lockfileDigests = readLockfileDigests();
      const sourceInputDigests = readBuildInputDigests();
      const sourceInputTotalBytes = sourceInputDigests.reduce((sum, file) => sum + file.sizeBytes, 0);
      const buildProvenanceSource = `${JSON.stringify(
        {
          schemaVersion: "build_provenance_v1",
          appRoot: appBoundary.appRoot,
          distRoot: appBoundary.distRoot,
          workspacePackage: appBoundary.workspacePackage,
          sourceInputDigest: buildAggregateDigest(sourceInputDigests),
          sourceInputFileCount: sourceInputDigests.length,
          sourceInputTotalBytes,
          buildCommand: "npm run build",
          packageManager: inferPackageManager(lockfileDigests),
          nodeVersion: process.version,
          builder: {
            type: "committed_dist_attestation",
            source: appBoundary.buildProvenancePath,
            name: "plannerxchange-template-vite-plugin"
          },
          aggregateArtifactDigest: buildAggregateDigest(artifactDigests),
          dependencyLockfileDigests: lockfileDigests,
          files: artifactDigests
        },
        null,
        2
      )}\n`;

      writeFileSync(join(outputDir, buildProvenanceFileName), buildProvenanceSource);
    }
  };
}

export default defineConfig({
  plugins: [react(), plannerXchangePublishManifestPlugin()],
  // Note: Vite defaults to port 5173. Do not change this — PlannerXchange's dev
  // environment allows CORS and Cognito auth callbacks from localhost:5173.
  build: {
    outDir: appBoundary.distRoot,
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
        plugin: resolve(rootDir, appBoundary.pluginSourcePath)
      },
      // preserveEntrySignatures is required so Rollup keeps the `mount` export
      // on the plugin chunk instead of tree-shaking or re-routing it.
      preserveEntrySignatures: "exports-only"
    }
  }
});

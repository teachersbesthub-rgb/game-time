import JSZip from "jszip";

// Eagerly collect every source file as a raw string so the bundle is
// completely self-contained and works offline.
const RAW: Record<string, string> = import.meta.glob(
  [
    "/src/**/*",
    "/*.md",
    "/*.json",
    "/*.ts",
    "/*.js",
    "/*.mjs",
    "/*.cjs",
    "/*.html",
    "/.prettierrc",
    "/.prettierignore",
    "/.gitignore",
    "/public/**/*",
    "!/src/routeTree.gen.ts",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

// Files we intentionally exclude from the ownership bundle.
const EXCLUDE = /(^\/src\/routeTree\.gen\.ts$|\/node_modules\/|\/\.lovable\/|\/dist\/|\/\.git\/)/;

function stripLeadingSlash(p: string): string {
  return p.replace(/^\//, "");
}

export interface BundleGroup {
  label: string;
  match: (path: string) => boolean;
}

export const BUNDLE_GROUPS: Record<string, BundleGroup> = {
  full: {
    label: "Full Project",
    match: () => true,
  },
  source: {
    label: "Source Code",
    match: (p) => p.startsWith("/src/"),
  },
  components: {
    label: "React Components",
    match: (p) => p.startsWith("/src/") && /\.(tsx|jsx)$/.test(p),
  },
  typescript: {
    label: "TypeScript Files",
    match: (p) => p.startsWith("/src/") && /\.(ts|tsx)$/.test(p),
  },
  eventEngine: {
    label: "Event Engine",
    match: (p) => p === "/src/lib/event-store.ts",
  },
  enneagramEngine: {
    label: "Enneagram Engine",
    match: (p) => p === "/src/lib/enneagram.ts",
  },
  chemistryEngine: {
    label: "Chemistry Engine",
    match: (p) => p === "/src/lib/event-store.ts" || p === "/src/lib/enneagram.ts",
  },
  config: {
    label: "Configuration",
    match: (p) =>
      /^\/(package\.json|tsconfig\.json|vite\.config\.ts|components\.json|eslint\.config\.js|bunfig\.toml|\.prettierrc|\.prettierignore|\.gitignore)$/.test(
        p,
      ),
  },
  dataModels: {
    label: "Data Models",
    match: (p) => p === "/src/lib/enneagram.ts" || p === "/src/lib/event-store.ts",
  },
  docs: {
    label: "Documentation",
    match: (p) => /\.md$/i.test(p),
  },
};

export function listBundleFiles(groupKey: keyof typeof BUNDLE_GROUPS): string[] {
  const g = BUNDLE_GROUPS[groupKey];
  return Object.keys(RAW)
    .filter((p) => !EXCLUDE.test(p) && g.match(p))
    .sort();
}

export async function buildSourceZip(
  groupKey: keyof typeof BUNDLE_GROUPS,
  extras: Record<string, string> = {},
): Promise<Blob> {
  const zip = new JSZip();
  const files = listBundleFiles(groupKey);
  for (const p of files) {
    zip.file(stripLeadingSlash(p), RAW[p]);
  }
  for (const [name, content] of Object.entries(extras)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

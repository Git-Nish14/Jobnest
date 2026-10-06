import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

interface ClientManifest {
  entryCSSFiles: Record<string, Array<{ path: string }>>;
}

/** Serve Next's emitted CSS verbatim: do not run it through Vite or PostCSS. */
export function nextProductionCss(webRoot: string): Plugin {
  const buildRoot = path.join(webRoot, ".next");
  const routes = ["(dashboard)/applications", "(dashboard)/applications/[id]/edit"];
  const files = new Map<string, string>();

  for (const route of routes) {
    const filename = path.join(buildRoot, "server/app", route, "page_client-reference-manifest.js");
    let source: string;
    try { source = readFileSync(filename, "utf8"); }
    catch { throw new Error("Production CSS tests require a current Next build. Run npm run build first."); }
    // Parse the JSON assignment; never execute generated application JavaScript.
    const assignment = source.indexOf(" = ", source.indexOf("\n"));
    if (assignment < 0) throw new Error(`Unrecognized Next client manifest: ${filename}`);
    const manifest = JSON.parse(source.slice(assignment + 3).trim().replace(/;$/, "")) as ClientManifest;
    const entry = Object.entries(manifest.entryCSSFiles).find(([key]) => key.endsWith(`/app/${route}/page`));
    if (!entry) throw new Error(`Missing production CSS entry for ${route}`);
    for (const file of entry[1]) {
      if (!files.has(file.path)) files.set(file.path, readFileSync(path.join(buildRoot, file.path), "utf8"));
    }
  }

  const compiledCss = [...files.values()].join("\n");
  const prefix = "/__next-production-css/";
  const virtualPrefix = "\0next-production-style:";

  return {
    name: "next-production-css-fixture",
    enforce: "pre",
    resolveId(source) {
      if (source.endsWith(".css")) return `${virtualPrefix}${encodeURIComponent(source)}.js`;
    },
    load(id) {
      if (!id.startsWith(virtualPrefix)) return;
      const source = decodeURIComponent(id.slice(virtualPrefix.length, -3));
      if (!source.endsWith(".module.css")) return "export default {};";
      const stem = path.basename(source, ".css").replaceAll(".", "-");
      const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const selector = new RegExp(`\\.(${escapedStem}__[A-Za-z0-9_-]+?__([A-Za-z][A-Za-z0-9_-]*))`, "g");
      const tokens: Record<string, string> = {};
      for (const match of compiledCss.matchAll(selector)) tokens[match[2]] = match[1];
      if (!Object.keys(tokens).length) throw new Error(`No compiled CSS module tokens found for ${source}; rebuild Next.`);
      return `export default ${JSON.stringify(tokens)};`;
    },
    transformIndexHtml() {
      return [
        { tag: "meta", attrs: { name: "mobile-fixture-css", content: "next-production-build" } },
        ...[...files.keys()].map((file) => ({ tag: "link", attrs: { rel: "stylesheet", href: `${prefix}${file}`, "data-next-build-css": "true" } })),
      ];
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?")[0];
        if (!pathname?.startsWith(prefix)) return next();
        const relative = pathname.slice(prefix.length);
        const css = files.get(relative);
        if (css !== undefined) {
          response.setHeader("Content-Type", "text/css; charset=utf-8");
          response.end(css);
          return;
        }
        // Next font URLs are relative to the emitted CSS chunks.
        if (/^static\/media\/[A-Za-z0-9_.-]+\.(woff2?|ttf)$/.test(relative)) {
          try {
            response.setHeader("Content-Type", relative.endsWith("woff2") ? "font/woff2" : "application/octet-stream");
            response.end(readFileSync(path.join(buildRoot, relative)));
            return;
          } catch { /* A missing asset must fail visibly, not fall back to source CSS. */ }
        }
        response.statusCode = 404;
        response.end("Unknown Next build asset");
      });
    },
  };
}

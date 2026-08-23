import { fileURLToPath } from "node:url";
/*
 * Le serveur de relecture.
 *
 * La page est un fichier statique : elle n'a besoin de rien pour vivre sur GitHub Pages.
 * Ce serveur n'existe que pour la regarder avant de la publier, parce qu'un `file://`
 * ne charge pas la feuille de style de la même façon et qu'on finit par valider autre
 * chose que ce qui sera servi.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { isMain } from "./cli.ts";

const PORT = Number(process.env.PORT ?? 4300);
const DOCS = fileURLToPath(new URL("../docs/", import.meta.url));
const TYPES: Record<string, string> = { html: "text/html", css: "text/css", js: "text/javascript" };

export const serveur = createServer((req, res) => {
  const chemin = decodeURIComponent(new URL(req.url ?? "/", `http://localhost:${PORT}`).pathname);
  const fichier = DOCS + (chemin === "/" ? "index.html" : chemin.replace(/^\/+/, "").replace(/\.\./g, ""));
  if (!existsSync(fichier)) { res.writeHead(404).end("introuvable"); return; }
  const ext = fichier.split(".").pop() ?? "";
  res.writeHead(200, {
    "content-type": `${TYPES[ext] ?? "application/octet-stream"}; charset=utf-8`,
    "cache-control": "no-store",
  });
  res.end(readFileSync(fichier));
});

/* Sur 127.0.0.1 et pas sur `::` : un aperçu local n'a rien à faire sur le réseau local. */
if (isMain(import.meta)) serveur.listen(PORT, "127.0.0.1", () => console.log(`vitrine → http://localhost:${PORT}`));

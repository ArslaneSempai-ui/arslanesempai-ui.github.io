/*
 * LES LIENS DES README.
 *
 * Un lien mort ne casse rien : la page s'affiche, le lecteur clique, et c'est lui qui
 * découvre le trou. Deux défauts trouvés en les passant en revue, et deux formes
 * différentes :
 *
 *  1. **Un lien absent.** Les README de l'entonnoir et du temps de cycle ne contenaient
 *     aucune URL — pas une seule. Leurs démos étaient publiées, en ligne, fonctionnelles,
 *     et la page qu'un recruteur ouvre en premier ne les mentionnait pas. Un lien mort se
 *     voit ; un lien qui n'existe pas, non.
 *  2. **Un lien vers ce qui doit rester fermé.** Le moteur de recherche documentaire est
 *     privé et sa vitrine publique porte un autre nom. Une seule ligne recopiée d'un dépôt
 *     à l'autre exposerait la décision.
 *
 * Ce qui n'est pas testé ici : que les URL externes répondent. Cela demande le réseau, et
 * un test qui échoue parce qu'un site tiers est lent apprend à être ignoré. La joignabilité
 * se vérifie à la main, en même temps que les démos.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const VOISINS = new URL("../../", import.meta.url).pathname;

/** Chaque outil, son dépôt public, et la démo que son README doit annoncer. */
const OUTILS = [
  { dossier: "economics", demo: "alert-triage-economics" },
  { dossier: "triage", demo: "kyc-triage-agent" },
  { dossier: "funnel", demo: "funnel-economics" },
  { dossier: "cycle", demo: "process-cycle-time" },
  { dossier: "banc", demo: "regression-bench" },
  { dossier: "rag-vitrine", demo: "compliance-document-search" },
];

const lire = (d: string) => readFileSync(`${VOISINS}${d}/README.md`, "utf8");
const present = (d: string) => existsSync(`${VOISINS}${d}/README.md`);

test("chaque outil annonce sa démo en ligne", (t) => {
  const absents = OUTILS.filter((o) => present(o.dossier))
    .filter((o) => !lire(o.dossier).includes(`https://arslanesempai-ui.github.io/${o.demo}/`))
    .map((o) => o.dossier);
  if (OUTILS.every((o) => !present(o.dossier))) return t.skip("aucun dépôt voisin");
  assert.deepEqual(absents, [],
    `${absents.join(", ")} : la démo est publiée et le README ne la mentionne pas`);
});

test("aucun README ne pointe vers le dépôt gardé privé", () => {
  for (const o of [...OUTILS, { dossier: "profil", demo: "" }, { dossier: "rag", demo: "" }]) {
    if (!present(o.dossier)) continue;
    assert.ok(!lire(o.dossier).includes("recherche-documentaire"),
      `${o.dossier}/README.md nomme le dépôt privé : le lien doit aller sur compliance-document-search`);
  }
});

test("tout fichier lié par un README existe et est suivi par git", () => {
  const casses: string[] = [];
  for (const o of [...OUTILS, { dossier: "profil", demo: "" }, { dossier: "rag", demo: "" }]) {
    if (!present(o.dossier)) continue;
    const texte = lire(o.dossier);
    const cibles = [...texte.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]!)
      .filter((l) => !/^(https?:|mailto:|#)/.test(l))
      .map((l) => l.split("#")[0]!);
    for (const cible of new Set(cibles)) {
      const chemin = `${VOISINS}${o.dossier}/${cible}`;
      if (!existsSync(chemin)) { casses.push(`${o.dossier}/${cible} — absent`); continue; }
      /* Présent sur le disque ne suffit pas : un fichier ignoré par git donne un 404 sur
       * GitHub, exactement comme un lien faux. */
      try {
        execFileSync("git", ["ls-files", "--error-unmatch", cible],
          { cwd: `${VOISINS}${o.dossier}`, stdio: "ignore" });
      } catch { casses.push(`${o.dossier}/${cible} — non suivi par git`); }
    }
  }
  assert.deepEqual(casses, [], casses.join(" · "));
});

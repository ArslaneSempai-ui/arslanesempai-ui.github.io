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
import { OUTILS as PAGES_OUTILS } from "./pages.ts";

const VOISINS = new URL("../../", import.meta.url).pathname;

/** Chaque outil, son dépôt public, et la démo que son README doit annoncer. */
/*
 * LA LISTE VIENT DE `pages.ts`, ET ELLE EN IGNORAIT QUATRE.
 *
 * Six outils étaient écrits ici à la main, contre dix publiés : `arbitrage`, `cascade`,
 * `derive` et `remediation` n'étaient vérifiés par rien. Leurs README annoncent bien leur
 * démo aujourd'hui — mesuré le 22 août 2026 — donc le contrôle était étroit sans être faux ;
 * mais rien ne l'aurait vu si l'un cessait, et c'est exactement ce qu'un contrôle de liens
 * existe pour voir.
 *
 * Le `dossier` vient de `pages.ts` et n'est pas déduit de la clé : `cle: "rag"` désigne la
 * recherche documentaire publique, dont le dossier est `rag-vitrine`, tandis que le dossier
 * local `rag` est le dépôt gardé privé. Déduire aurait fait lire le mauvais README.
 */
const OUTILS = PAGES_OUTILS.map((o) => ({ dossier: o.dossier, demo: o.depot }));

const lire = (d: string) => readFileSync(`${VOISINS}${d}/README.md`, "utf8");
const present = (d: string) => existsSync(`${VOISINS}${d}/README.md`);

/*
 * CE QUE CES TROIS CAS ONT REGARDÉ, ET PAS SEULEMENT CE QU'ILS N'ONT PAS TROUVÉ.
 *
 * Chacun écartait les dépôts absents en silence — un `continue`, ou un `filter(present)`.
 * Le cas TOTAL était prévu : « aucun dépôt voisin » sautait en le disant. Le cas PARTIEL
 * ne l'était pas. Trois voisins sur dix présents, et les trois cas passaient en ayant lu
 * trois README sur dix, sans qu'aucun compte ne baisse et sans un mot.
 *
 * Même forme que l'estampille morte du 22 août 2026 : ce n'est pas le contrôle qui regarde
 * mal, c'est la liste qu'on lui donne qui a été vidée avant lui. Un filtre placé devant une
 * assertion de vide peut toujours la satisfaire en la privant d'objet.
 *
 * Hors clone seul, les dix voisins sont là — mesuré. Un manquant est donc un fait à nommer,
 * jamais une raison de regarder moins.
 */
const SEUL = !existsSync(new URL("../../identite/depots.json", import.meta.url).pathname);
const siSeul = (t: { skip: (m: string) => void }) =>
  SEUL && (t.skip("dépôt cloné seul — les voisins ne sont pas là, ces cas n'ont pas d'objet"), true);

/** Refuse de rétrécir en silence : tout dossier attendu doit être lisible. */
function exigerTous(dossiers: string[]): string[] {
  const absents = dossiers.filter((d) => !present(d));
  assert.deepEqual(absents, [],
    `${absents.join(", ")} : README introuvable — ces dépôts sortiraient du contrôle `
    + `sans qu'aucun compte ne baisse, et le vert ne voudrait plus rien dire`);
  return dossiers;
}

test("chaque outil annonce sa démo en ligne", (t) => {
  if (siSeul(t)) return;
  exigerTous(OUTILS.map((o) => o.dossier));
  const absents = OUTILS
    .filter((o) => !lire(o.dossier).includes(`https://arslanesempai-ui.github.io/${o.demo}/`))
    .map((o) => o.dossier);
  assert.deepEqual(absents, [],
    `${absents.join(", ")} : la démo est publiée et le README ne la mentionne pas`);
});

test("aucun README ne pointe vers le dépôt gardé privé", (t) => {
  if (siSeul(t)) return;
  const TOUS = [...OUTILS, { dossier: "profil", demo: "" }, { dossier: "rag", demo: "" }];
  exigerTous(TOUS.map((o) => o.dossier));
  for (const o of TOUS) {
    assert.ok(!lire(o.dossier).includes("recherche-documentaire"),
      `${o.dossier}/README.md nomme le dépôt privé : le lien doit aller sur compliance-document-search`);
  }
});

test("tout fichier lié par un README existe et est suivi par git", (t) => {
  if (siSeul(t)) return;
  const casses: string[] = [];
  const TOUS = [...OUTILS, { dossier: "profil", demo: "" }, { dossier: "rag", demo: "" }];
  exigerTous(TOUS.map((o) => o.dossier));
  for (const o of TOUS) {
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

test("témoin : un dépôt manquant fait tomber le contrôle, il ne le rétrécit pas", () => {
  /*
   * Prouvé sans rien effacer ni renommer : on appelle l'aide sur un nom qui n'existe pas.
   * Une garde de couverture qui n'a jamais été vue tomber est une intention, pas un
   * contrôle — et c'est précisément l'erreur qu'on répare ici.
   */
  assert.throws(() => exigerTous(["dossier-qui-nexiste-pas"]), /README introuvable/,
    "la garde de couverture ne tire pas : elle laisserait un dépôt sortir du contrôle en silence");
  /* Et le pendant : elle ne doit pas tirer sur la liste saine, sinon elle est inutilisable. */
  if (!SEUL) {
    assert.doesNotThrow(() => exigerTous(OUTILS.map((o) => o.dossier)),
      "la garde refuse la liste réelle — elle est trop stricte pour servir");
  }
});

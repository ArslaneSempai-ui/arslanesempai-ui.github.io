/*
 * CE QUE CETTE PAGE N'A PAS LE DROIT DE FAIRE.
 *
 * Une page d'accueil est le seul endroit du portfolio que tout le monde lit et que personne
 * ne relit. Elle résume six modèles qu'elle ne contient pas : elle peut donc se périmer en
 * silence, et affirmer sur sa vitrine le contraire de ce que disent les outils derrière.
 *
 * Ces tests ferment quatre portes, dans l'ordre de ce qui coûterait le plus cher :
 *
 *  1. **Un chiffre de la page qui ne serait plus celui du modèle.** `mesurer.ts --check`
 *     compare `chiffres.json` aux mesures ; ici on va plus loin et on vérifie que le même
 *     nombre figure dans le README de l'outil concerné. Deux sources se contredisant sur
 *     un CV est pire que pas de chiffre du tout.
 *  2. **Un lien vers le moteur privé.** Le dépôt de recherche documentaire est délibérément
 *     fermé ; la démo et l'article sont publics. Une seule ligne mal recopiée exposerait ce
 *     qu'on a choisi de garder.
 *  3. **Une tuile muette.** Si un outil disparaît du build sans faire échouer quoi que ce
 *     soit, la page continue de s'afficher — avec cinq outils.
 *  4. **Une moitié de traduction.** Le sélecteur ne fait que cacher des blocs : une phrase
 *     oubliée en français devient une page à trous, pas un message d'erreur.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const racine = new URL("..", import.meta.url).pathname;
const voisins = new URL("../../", import.meta.url).pathname;
const page = () => readFileSync(racine + "docs/index.html", "utf8");
const chiffres = () => JSON.parse(readFileSync(racine + "chiffres.json", "utf8"));

const OUTILS = ["economics", "triage", "funnel", "cycle", "banc", "rag", "arbitrage", "cascade"];

test("chaque outil a ses chiffres", () => {
  const c = chiffres();
  for (const o of OUTILS) {
    assert.ok(c[o], `chiffres.json n'a rien pour « ${o} »`);
    assert.ok(Object.keys(c[o]).length >= 4, `« ${o} » n'a que ${Object.keys(c[o]).length} chiffre(s)`);
  }
});

test("chaque outil a sa tuile, avec ses deux liens", () => {
  const h = page();
  const liens = [
    ["alert-triage-economics", 2], ["kyc-triage-agent", 2], ["funnel-economics", 2],
    ["process-cycle-time", 2], ["regression-bench", 2], ["compliance-document-search", 2],
    ["growth-versus-controls", 2], ["cascade-routing", 2],
  ] as const;
  for (const [depot, combien] of liens) {
    const vus = h.split(depot).length - 1;
    assert.equal(vus, combien, `« ${depot} » apparaît ${vus} fois, attendu ${combien} (démo + source)`);
  }
  /* La tuile est devenue une ligne de relevé : ce qui est gardé, c'est qu'il y ait un
   * outil par entrée et deux liens chacun, pas le nom de la balise. */
  assert.equal(h.split('<div class="outil">').length - 1, OUTILS.length);
});

test("aucun lien vers le moteur gardé privé", () => {
  /*
   * Le dépôt s'appelle `recherche-documentaire` et il est fermé. Ce test ne protège pas un
   * secret — il protège une décision, qui est plus facile à défaire par mégarde.
   */
  assert.ok(!page().includes("recherche-documentaire"),
    "la page pointe vers le moteur privé : le lien doit aller sur compliance-document-search");
});

test("la page n'a pas perdu ses parties en route", () => {
  /*
   * Ce test gardait l'appariement des deux langues. La page est passée à l'anglais seul,
   * et l'appariement n'existe plus — mais ce qu'il attrapait vraiment reste vrai : une
   * transformation de masse sur le gabarit peut emporter des sections entières sans que
   * rien ne casse. On garde donc la garde, sur ce qui doit être là.
   */
  const h = page();
  assert.ok(!h.includes('class="fr"') && !h.includes('class="en"'),
    "des fragments de bascule de langue subsistent dans la page");
  for (const attendu of ["Your figures", "What already leaves the account",
                         "What a project would go after", 'class="outil"']) {
    assert.ok(h.includes(attendu), `la page ne contient plus « ${attendu} »`);
  }
  /*
   * Le titre et le grand titre comptent la même chose, et ce compte est celui des outils.
   *
   * Ils étaient écrits « six » à la main : le septième outil est arrivé et la page a
   * annoncé six pendant que la liste en montrait sept. Pire, le garde-fou d'à côté est
   * passé au vert parce qu'il trouvait la vieille phrase — dans la balise `<title>`, la
   * seule qui n'avait pas encore été reprise. Un contrôle qui cherche une chaîne n'importe
   * où dans la page trouve toujours la mauvaise occurrence un jour.
   */
  const h1 = h.match(/<h1>([^<]*)<\/h1>/)?.[1] ?? "";
  const titre = h.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  const outils = h.split('class="outil"').length - 1;
  const attenduTitre = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
                        "nine", "ten", "eleven", "twelve"][outils];
  assert.match(h1.toLowerCase(), new RegExp(`^${attenduTitre} numbers`),
    `le grand titre dit « ${h1} » pour ${outils} outils`);
  assert.equal(titre.toLowerCase(), h1.toLowerCase(), "le titre de l'onglet et le grand titre divergent");
  /* Mesuré, pas deviné : la page en fait 24 000 après le passage à l'anglais seul. Le
   * plancher attrape la perte d'une section entière, pas une phrase réécrite. */
  assert.ok(h.length > 20_000, `la page ne fait que ${h.length} octets : elle a maigri`);
});

test("la page n'annonce que des chiffres mesurés", () => {
  const h = page(), c = chiffres();
  /* Chaque affirmation de tuile doit être retrouvable dans le HTML construit. */
  const attendus: [string, string][] = [
    ["economics", String(c.economics.analystesEnPoste - c.economics.analystesUtilises)],
    ["triage", String(c.triage.manquements)],
    ["funnel", String(c.funnel.meilleurRendement)],
    ["cycle", String(c.cycle.joursDeBoutEnBout)],
    ["banc", String(c.banc.passesALaFin)],
    ["rag", String(c.rag.silencesJustifies)],
  ];
  for (const [outil, valeur] of attendus) {
    assert.ok(h.includes(valeur), `la tuile « ${outil} » n'affiche pas ${valeur}`);
  }
});

/*
 * L'accord avec les README.
 *
 * Les README sont générés depuis les mêmes modèles, par un autre chemin de code. Si les
 * deux chemins divergent, l'un des deux ment — et on ne saura pas lequel en regardant la
 * page. Un dépôt absent est sauté avec un message : ne pas pouvoir vérifier n'est pas la
 * même chose que vérifier.
 */
const ACCORDS: { cle: string; readme: string; valeurs: (c: any) => string[] }[] = [
  { cle: "economics", readme: "economics/README.md",
    valeurs: (c) => [String(c.aTrouver), c.coutAnnuel.toLocaleString("en-GB")] },
  { cle: "triage", readme: "triage/README.md", valeurs: (c) => [String(c.dossiers)] },
  { cle: "funnel", readme: "funnel/README.md", valeurs: (c) => [c.meilleurRendement.toFixed(1)] },
  { cle: "cycle", readme: "cycle/README.md",
    valeurs: (c) => [String(c.routesDistinctes), (c.partAttente * 100).toFixed(1)] },
  { cle: "banc", readme: "banc/README.md", valeurs: (c) => [String(c.cas)] },
  /* Pour la recherche documentaire, l'accord se fait avec le dépôt *public*. */
  { cle: "rag", readme: "rag-vitrine/README.md",
    valeurs: (c) => [String(c.questions), String(c.silencesJustifies)] },
];

for (const a of ACCORDS) {
  test(`les chiffres de « ${a.cle} » concordent avec son README`, (t) => {
    const chemin = voisins + a.readme;
    if (!existsSync(chemin)) return t.skip(`${a.readme} absent — accord non vérifié`);
    const texte = readFileSync(chemin, "utf8");
    for (const v of a.valeurs(chiffres()[a.cle])) {
      assert.ok(texte.includes(v),
        `la vitrine annonce « ${v} » pour ${a.cle}, absent de ${a.readme} — l'un des deux a vieilli`);
    }
  });
}

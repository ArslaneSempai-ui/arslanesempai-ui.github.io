/*
 * LA PAGE QUE PERSONNE NE VÉRIFIE.
 *
 * Le README du profil GitHub est la première chose qu'un recruteur lit, et le seul écrit à
 * la main : les six autres sont générés depuis leurs modèles et tenus par `readme.ts
 * --check`. Il a donc vieilli exactement là où c'était le plus coûteux — « 147 tests »
 * quand il y en avait 167, et un montant emprunté au mauvais tableau : « après quoi ça
 * coûte 85 846 $ », alors que le premier pas payant après le seuil gratuit en coûte 32 476.
 * Le 85 846 existe bien, deux marches plus loin et dans un autre modèle.
 *
 * Ces tests ne relisent pas la prose. Ils tiennent les chiffres, qui sont la seule chose
 * qu'une page de vitrine peut affirmer faussement sans que personne s'en aperçoive.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { DEPOTS, dernierTest } from "./compter.ts";
import { OUTILS } from "./pages.ts";

const PROFIL = new URL("../../profil/README.md", import.meta.url).pathname;
const chiffres = () => JSON.parse(readFileSync(new URL("../chiffres.json", import.meta.url).pathname, "utf8"));
/*
 * On lit la page telle qu'elle sera rendue.
 *
 * Depuis que les affirmations portent leur marque de provenance — `<!--p:clé-->valeur<!--/p-->`,
 * invisible sur GitHub — chercher une chaîne littérale dans le fichier ne trouve plus rien.
 * Ces tests parlent de ce que le lecteur voit, donc ils enlèvent les commentaires d'abord.
 */
const lire = () => readFileSync(PROFIL, "utf8").replace(/<!--[\s\S]*?-->/g, "");

/** Chaque affirmation chiffrée de la page, et la mesure dont elle doit sortir. */
const AFFIRMATIONS: { quoi: string; valeur: (c: any) => string }[] = [
  { quoi: "les analystes en poste", valeur: (c) => String(c.economics.analystesEnPoste) },
  { quoi: "le seuil encore gratuit", valeur: (c) => c.economics.seuilGratuitLePlusLarge.toFixed(2) },
  { quoi: "le premier cas payant", valeur: (c) => "$" + c.economics.premierCasPayant.toLocaleString("en-GB") },
  { quoi: "les jours de bout en bout", valeur: (c) => c.cycle.joursDeBoutEnBout.toFixed(1) },
  { quoi: "les heures travaillées", valeur: (c) => c.cycle.heuresTravaillees.toFixed(1) },
  { quoi: "les routes distinctes", valeur: (c) => String(c.cycle.routesDistinctes) },
  { quoi: "le meilleur rendement", valeur: (c) => c.funnel.meilleurRendement.toFixed(1) },
  { quoi: "le pire rendement", valeur: (c) => c.funnel.pireRendement.toFixed(1) },
  { quoi: "les dossiers triés", valeur: (c) => String(c.triage.dossiers) },
  { quoi: "les cas du banc", valeur: (c) => String(c.banc.cas) },
  { quoi: "les cas passés au début", valeur: (c) => String(c.banc.passesAuDebut) },
  { quoi: "les cas passés à la fin", valeur: (c) => String(c.banc.passesALaFin) },
  { quoi: "les questions de contrôle", valeur: (c) => String(c.rag.questions) },
  { quoi: "les silences justifiés", valeur: (c) => String(c.rag.silencesJustifies) },
];

test("chaque chiffre de la page d'accueil sort d'une mesure", (t) => {
  if (!existsSync(PROFIL)) return t.skip("dépôt profil absent — accord non vérifié");
  const texte = lire(), c = chiffres();
  const absents = AFFIRMATIONS.filter((a) => !texte.includes(a.valeur(c)))
    .map((a) => `${a.quoi} (${a.valeur(c)})`);
  assert.deepEqual(absents, [],
    `la page annonce autre chose que la mesure pour : ${absents.join(" · ")}`);
});

test("le nombre de tests annoncé est celui qui a été compté", (t) => {
  if (!existsSync(PROFIL)) return t.skip("dépôt profil absent");
  const p = chiffres().portfolio;
  assert.ok(p?.tests, "aucun comptage enregistré — lancer `npm run compter`");
  assert.ok(lire().includes(`**${p.tests} tests.**`),
    `la page n'annonce pas « ${p.tests} tests » — lancer \`npm run compter\` puis corriger le README`);
});

test("aucun dépôt n'a commité de test depuis ce comptage", (t) => {
  /*
   * Le compte juste coûte quatre-vingts secondes : trop pour chaque `npm test`. On ne le
   * rejoue donc pas, on vérifie seulement qu'il n'a pas pu se périmer — si le dernier
   * commit touchant un fichier de test a changé quelque part, le nombre affiché sur la
   * page d'accueil n'est plus garanti.
   */
  if (process.env.COMPTAGE) return t.skip("comptage en cours — ce contrôle est sans objet");
  const p = chiffres().portfolio;
  if (!p?.testsCommitesLe) return t.skip("aucun comptage enregistré");
  const bouges = DEPOTS.filter((d) => {
    const vu = dernierTest(d);
    return vu !== null && p.testsCommitesLe[d] != null && vu !== p.testsCommitesLe[d];
  });
  assert.deepEqual(bouges, [],
    `des tests ont été commités depuis le comptage (${bouges.join(", ")}) — lancer \`npm run compter\``);
});

test("l'estampille de fraîcheur couvre tous les dépôts, sinon elle ne garde rien", () => {
  /*
   * Le contrôle voisin n'examine un dépôt que si `dernierTest` lui rend un commit : un
   * dépôt sans estampille est écarté en silence, et un contrôle qui écarte tout le monde
   * passe toujours. C'est ce qui est arrivé — le motif ne voyait que `src/*.test.ts`,
   * `identite` range ses tests à la racine et ses fichiers sont des `.mjs`.
   *
   * Ce cas-ci mesure la couverture au lieu de la supposer : chaque dépôt que le compte
   * interroge doit rendre un commit. Si le motif se rétrécit à nouveau, c'est ici que ça
   * tombe, et pas six commits plus tard.
   */
  const sans = DEPOTS.filter((d) => dernierTest(d) === null);
  assert.ok(DEPOTS.length >= 11, `seulement ${DEPOTS.length} dépôt(s) découvert(s) : la liste est vide ou tronquée`);
  assert.deepEqual(sans, [],
    `${sans.join(", ")} : aucun commit de test trouvé — le contrôle de fraîcheur les écarte `
    + `en silence, et un contrôle qui n'examine personne est vert par construction.`);
});

/*
 * LES LIENS, ET CE QUE LA PAGE LAISSE VOIR.
 *
 * L'en-tête de ce fichier dit que ces tests tiennent les chiffres et ne relisent pas la
 * prose. Ce bloc élargit ça d'un cran, et pour une raison mesurée : le 22 août 2026, une
 * page publiée nommait le chemin local du dépôt privé. Un lien mort ou un chemin de
 * machine sur la première page qu'un recruteur ouvre coûte plus cher qu'un chiffre faux,
 * et rien ne les regardait — le profil n'a ni test ni build.
 *
 * Tout se vérifie hors ligne : on ne va pas demander à GitHub si un dépôt existe, on
 * confronte les liens au registre que la vitrine tient déjà. Un contrôle qui dépend du
 * réseau tombe en panne les jours où le réseau tombe, et on apprend à ignorer son rouge.
 */
const DEPOT_LIEN = /https:\/\/github\.com\/ArslaneSempai-ui\/([\w.-]+)/g;

/** Les défauts d'un profil, sur un texte quelconque — pour pouvoir le prouver sur un faux. */
function defauts(texte: string, fichiersVoisins: (f: string) => boolean): string[] {
  const p: string[] = [];
  const connus = new Set(OUTILS.map((o: any) => o.depot));
  const lies = new Set([...texte.matchAll(DEPOT_LIEN)].map((m) => m[1]));
  for (const d of lies) if (!connus.has(d)) p.push(`lien vers un dépôt inconnu du registre : ${d}`);
  for (const d of connus) if (!lies.has(d)) p.push(`outil publié mais absent du profil : ${d}`);

  /* Ce que la page ne doit pas laisser voir. Le dossier local du moteur privé s'appelle
     `rag` ; son dépôt public s'appelle autrement. Nommer l'un depuis l'autre est la fuite
     qui a déjà eu lieu une fois aujourd'hui, dans `rag/src/ui.html`. */
  for (const [motif, quoi] of [
    [/\/Users\/[\w.-]+/, "un chemin de la machine"],
    [/~\/Documents\//, "un chemin du dossier personnel"],
    [/127\.0\.0\.1|localhost:\d+/, "une adresse de boucle locale"],
    [/\/(?:private\/)?tmp\//, "un dossier temporaire"],
  ] as [RegExp, string][]) {
    const m = motif.exec(texte);
    if (m) p.push(`${quoi} est visible sur la page publiée : ${m[0]}`);
  }

  /* Un lien relatif qui ne résout pas est un 404 sur le profil lui-même. */
  for (const m of texte.matchAll(/\]\((?!https?:|#|mailto:)([^)]+)\)/g)) {
    if (!fichiersVoisins(m[1])) p.push(`lien relatif qui ne résout pas : ${m[1]}`);
  }

  /* Les marques de provenance vont par paires : une ouvrante orpheline laisse le lecteur
     voir la valeur sans que la passe de prose sache la remettre à jour. */
  /* `[^>]+` et non `[\w.]+` : les clés portent un suffixe de format après un tilde —
     `cascade.coutOptimal~usd`, `derive.signal~n2`. Le motif étroit en reconnaissait 15 sur
     35 et accusait la page d'être déparée alors qu'elle est intacte. Exiger une forme
     plutôt que lire celle qui existe : la même erreur que la veille, en plus petit. */
  const ouvre = (texte.match(/<!--p:[^>]+-->/g) ?? []).length;
  const ferme = (texte.match(/<!--\/p-->/g) ?? []).length;
  if (ouvre !== ferme) p.push(`marques de provenance dépariées : ${ouvre} ouvrante(s), ${ferme} fermante(s)`);
  return p;
}

const VOISIN = (f: string) => existsSync(new URL("../../profil/" + f, import.meta.url).pathname);

test("le profil publié ne porte ni lien mort ni chemin de la machine", () => {
  const brut = readFileSync(PROFIL, "utf8");
  /* Avant de croire un zéro : la page doit vraiment porter des liens de dépôt. */
  const liens = [...brut.matchAll(DEPOT_LIEN)].length;
  assert.ok(liens >= 10, `seulement ${liens} lien(s) de dépôt lus : le motif est périmé`);
  assert.deepEqual(defauts(brut, VOISIN), []);
});

test("témoin : un profil fabriqué avec chacun de ces défauts est refusé", () => {
  /*
   * On casse une chose à la fois, mais sur une page fabriquée : la vraie ne bouge pas.
   * Un contrôle prouvé sur un faux positif fabriqué vaut ce que vaut le faux — donc il
   * reprend la vraie page et n'y change qu'un point.
   */
  const vrai = readFileSync(PROFIL, "utf8");
  const cas: [string, string, RegExp][] = [
    /* On vise l'URL et pas le nom : `[regression-bench](…/regression-bench)` porte le mot
       deux fois sur la même ligne, et `replace` sur une chaîne ne change que la première —
       donc le libellé. Le lien restait juste et le cas ne prouvait rien. */
    ["dépôt inconnu",
      vrai.replace(/(github\.com\/ArslaneSempai-ui\/)regression-bench/, "$1regression-banc"),
      /dépôt inconnu du registre/],
    ["outil manquant", vrai.replace(/https:\/\/github\.com\/ArslaneSempai-ui\/drift-monitor/, "https://example.com/x"), /absent du profil/],
    ["chemin machine", vrai + "\n\nvoir /Users/quelquun/Documents/rag/corpus\n", /chemin de la machine/],
    ["boucle locale", vrai + "\n\ndémo sur http://127.0.0.1:8000/\n", /boucle locale/],
    ["lien relatif mort", vrai + "\n\n[note](inexistant.md)\n", /lien relatif qui ne résout pas/],
    ["marque dépariée", vrai.replace("<!--/p-->", ""), /marques de provenance dépariées/],
  ];
  for (const [nom, texte, attendu] of cas) {
    assert.notEqual(texte, vrai, `le cas « ${nom} » n'a rien modifié — il ne prouve rien`);
    const p = defauts(texte, VOISIN);
    assert.ok(p.some((x) => attendu.test(x)),
      `le cas « ${nom} » n'a pas été attrapé.\n  relevé : ${p.join(" | ") || "aucun défaut"}`);
  }
});

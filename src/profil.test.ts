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

/*
 * Ce que le diagnostic n'a pas le droit de faire.
 *
 * Il produit des montants en dollars à partir des chiffres d'un inconnu. C'est la surface
 * la plus facile à rendre malhonnête de tout le portfolio : il suffit d'oublier une
 * étiquette, d'additionner deux sortes d'argent, ou de continuer à afficher un montant
 * quand l'entrée ne permet plus de le calculer. Les tests ci-dessous ferment ces portes-là,
 * dans l'ordre de ce qui coûterait le plus cher à la crédibilité.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnostiquer, separationPour, type Entrees } from "./diagnostic.ts";
import { ASSUMED } from "./emprunts/economics/calibrate.ts";

/** Une maison plausible, pour ne pas réécrire les mêmes dix lignes à chaque test. */
const MAISON: Entrees = {
  operations: 900_000, seuilActuel: 0.70, alertesParAn: 5_200, tauxReel: 0.04,
  analystesEnPoste: 12, coutChargeAnalyste: 78_000,
  entonnoir: [
    { etape: "signup", entres: 240_000, convertis: 41_000 },
    { etape: "activate", entres: 41_000, convertis: 22_800 },
    { etape: "subscribe", entres: 22_800, convertis: 4_900 },
    { etape: "retain", entres: 4_900, convertis: 3_700 },
  ],
  revenuParClient: 2_400,
};

test("sans rien fournir, le diagnostic n'affirme rien de plus que « supposé »", () => {
  const r = diagnostiquer({});
  assert.equal(r.niveau, 1);
  assert.deepEqual(r.separation, ASSUMED);
  for (const c of [...r.dejaPaye, ...r.aGagner]) {
    assert.equal(c.provenance, "supposé", `${c.cle} se dit ${c.provenance} sans rien recevoir`);
  }
});

test("deux chiffres observés font passer la détection en « ajusté »", () => {
  const r = diagnostiquer(MAISON);
  assert.equal(r.niveau, 2);
  /* Le bruit devient le leur : la moyenne des faux positifs bouge. */
  assert.notEqual(r.separation.falsePositiveMean, ASSUMED.falsePositiveMean);
  const eco = r.dejaPaye.find((c) => c.outil === "economics");
  assert.ok(eco, "aucun constat sur la détection");
  assert.equal(eco!.provenance, "ajusté");
});

/** Un export plausible : les cas réels scorent plus haut, avec un recouvrement. */
function fichierScore(n = 90) {
  return Array.from({ length: n }, (_, i) => {
    const reel = i % 3 === 0;
    return { score: reel ? 0.66 + (i % 7) * 0.02 : 0.28 + (i % 9) * 0.02, truePositive: reel };
  });
}

test("un fichier de dossiers scorés fait passer en « vôtre »", () => {
  const r = diagnostiquer({ ...MAISON, dossiersScores: fichierScore() });
  assert.equal(r.niveau, 3);
  const eco = r.dejaPaye.find((c) => c.outil === "economics");
  assert.equal(eco?.provenance, "vôtre");
  assert.equal(eco?.reserve, null, "au niveau 3 il ne reste rien à réserver sur la détection");
});

test("un fichier trop maigre ne suffit pas à décrocher le niveau 3 sur les deux composantes", () => {
  /* Trente lignes, mais presque aucune réelle : la forme du signal doit rester celle du dépôt. */
  const dossiers = Array.from({ length: 40 }, (_, i) => ({ score: 0.3 + i * 0.01, truePositive: i < 3 }));
  const { separation, refus } = separationPour({ dossiersScores: dossiers });
  assert.equal(separation.truePositiveMean, ASSUMED.truePositiveMean);
  assert.notEqual(separation.falsePositiveMean, ASSUMED.falsePositiveMean);
  assert.ok(refus.some((m) => /signal/.test(m)), refus.join(" · "));
});

test("l'argent déjà dépensé et l'argent à gagner ne se mélangent jamais", () => {
  const r = diagnostiquer(MAISON);
  assert.ok(r.dejaPaye.length > 0 && r.aGagner.length > 0, "le cas d'essai doit produire les deux");
  assert.ok(r.dejaPaye.every((c) => c.nature === "déjà payé"));
  assert.ok(r.aGagner.every((c) => c.nature === "à gagner"));
  /* Chacune des deux listes est triée pour elle-même. */
  for (const liste of [r.dejaPaye, r.aGagner]) {
    for (let i = 1; i < liste.length; i++) assert.ok(liste[i - 1]!.montant >= liste[i]!.montant);
  }
});

test("aucun montant ne sort sans son unité écrite", () => {
  /*
   * « $520 000 » sans unité se lit comme un chèque annuel, alors que c'est un gain par
   * point de conversion. L'unité n'est pas un ornement : elle empêche une lecture fausse.
   */
  for (const c of [...diagnostiquer(MAISON).dejaPaye, ...diagnostiquer(MAISON).aGagner]) {
    /* Les deux langues, pas seulement celle qu'on relit. Une traduction manquante ne se
     * voit qu'au moment où quelqu'un bascule — c'est-à-dire jamais, chez soi. */
    for (const langue of ["en", "fr"] as const) {
      assert.ok(c.unite[langue].trim().length > 0, `${c.cle} n'a pas d'unité en ${langue}`);
      assert.ok(c.phrase[langue].trim().length > 0, `${c.cle} n'a pas de phrase en ${langue}`);
      if (c.reserve) assert.ok(c.reserve[langue].trim().length > 0, `${c.cle} : réserve absente en ${langue}`);
    }
    assert.ok(c.lien.startsWith("https://"), `${c.cle} n'a pas de lien vérifiable`);
  }
});

test("un constat non « vôtre » porte toujours sa réserve", () => {
  const r = diagnostiquer(MAISON);
  for (const c of [...r.dejaPaye, ...r.aGagner]) {
    if (c.provenance === "vôtre") continue;
    assert.ok(c.reserve && c.reserve.fr.length > 20 && c.reserve.en.length > 20,
      `${c.cle} se dit « ${c.provenance} » sans dire ce qui reste supposé`);
  }
});

test("l'entonnoir refuse de désigner une étape que ses intervalles ne séparent pas", () => {
  /* Deux étapes au même taux, sur de petits volumes : rien ne les départage. */
  const serre = diagnostiquer({
    entonnoir: [
      { etape: "a", entres: 200, convertis: 40 },
      { etape: "b", entres: 200, convertis: 41 },
    ],
    revenuParClient: 1_000,
  });
  const f = serre.aGagner.find((c) => c.outil === "funnel");
  assert.ok(f, "aucun constat d'entonnoir");
  assert.ok(f!.reserve && /recouvre/.test(f!.reserve.fr) && /overlaps/.test(f!.reserve.en),
    JSON.stringify(f!.reserve));
});

test("un entonnoir sans étapes ne produit pas de constat plutôt qu'un zéro", () => {
  const r = diagnostiquer({ entonnoir: [{ etape: "seule", entres: 10, convertis: 1 }] });
  assert.equal(r.aGagner.find((c) => c.outil === "funnel"), undefined);
});

test("une observation impossible remonte au visiteur au lieu d'être ajustée de force", () => {
  const r = diagnostiquer({
    operations: 1_000, seuilActuel: 0.7, alertesParAn: 900_000, tauxReel: 0.5,
    analystesEnPoste: 4, coutChargeAnalyste: 70_000,
  });
  assert.ok(r.refus.length > 0, "une entrée absurde passe sans un mot");
});

test("un système qui ne sépare rien ne laisse aucune capacité libre à récupérer", () => {
  /*
   * Écrit après coup, parce qu'un échantillon mal construit l'a révélé : quand les deux
   * populations ont la même distribution, tout franchit le seuil ou rien, la file explose,
   * et il n'y a plus un analyste inoccupé. Le diagnostic doit alors se taire plutôt que
   * d'annoncer un montant. C'est le comportement voulu, donc il mérite d'être tenu.
   */
  const plat = Array.from({ length: 90 }, (_, i) => ({ score: 0.685, truePositive: i % 3 === 0 }));
  const r = diagnostiquer({ ...MAISON, dossiersScores: plat });
  assert.equal(r.niveau, 3);
  assert.equal(r.dejaPaye.find((c) => c.outil === "economics"), undefined,
    "un système sans pouvoir séparateur ne peut pas dégager de capacité libre");
  /* L'entonnoir, lui, ne dépend pas de la détection et doit rester là. */
  assert.ok(r.aGagner.some((c) => c.outil === "funnel"));
});

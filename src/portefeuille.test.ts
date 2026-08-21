/*
 * L'OUTIL QUI JUGE LES AUTRES, JUGÉ.
 *
 * `portefeuille` décide si douze dépôts vont bien, répare ce qui ne va pas, et enchaîne deux
 * mécanismes de propagation dans un ordre qui compte. Personne ne vérifiait qu'il sait
 * détecter une panne — c'était l'état de `diffuser` le matin du 19 août 2026, et de
 * `verifier-ecran` l'après-midi. Un contrôle non contrôlé finit toujours par mentir dans le
 * sens rassurant.
 *
 * On teste la décision, pas l'orchestration : ce qui se conclut de faits bruts.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { conclure, tour } from "./portefeuille.ts";
import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const vert = "ℹ pass 42\nℹ fail 0\n";
const rouge = "✖ un test tombe\nℹ pass 41\nℹ fail 1\n";

test("un dépôt sain, paquet à jour, ne produit aucun souci", () => {
  const c = conclure({ depot: "cascade", testOk: true, testSortie: vert, aDocs: true, temoinValide: true });
  assert.deepEqual(c.soucis, []);
  assert.deepEqual(c.reparations, []);
  assert.match(c.etat, /42 tests/);
  assert.match(c.etat, /paquet à jour/);
});

test("une suite en échec est signalée, avec sa cause", () => {
  const c = conclure({ depot: "banc", testOk: false, testSortie: rouge, aDocs: true, temoinValide: true });
  assert.equal(c.soucis.length, 1);
  assert.equal(c.soucis[0]!.quoi, "npm test");
  assert.match(c.soucis[0]!.detail, /un test tombe/);
});

test("un paquet publié périmé est une réparation, pas un souci", () => {
  /*
   * La distinction porte tout le rapport : un souci demande une décision, une réparation
   * informe. Les confondre ferait crier l'outil sur ce qu'il vient de résoudre, et on
   * cesserait de lire ses alertes.
   */
  const c = conclure({ depot: "cascade", testOk: true, testSortie: vert,
    aDocs: true, temoinValide: false, pagesOk: true, paquetChange: true });
  assert.deepEqual(c.soucis, []);
  assert.equal(c.reparations.length, 1);
  assert.match(c.etat, /PÉRIMÉ/);
});

test("une reconstruction qui échoue est un souci, pas une réparation", () => {
  const c = conclure({ depot: "rag", testOk: true, testSortie: vert,
    aDocs: true, temoinValide: false, pagesOk: false, pagesSortie: "erreur de build\n" });
  assert.equal(c.soucis.length, 1);
  assert.equal(c.soucis[0]!.quoi, "npm run pages");
  assert.deepEqual(c.reparations, []);
});

test("un paquet reconstruit à l'identique n'alerte sur rien", () => {
  /* Reconstruire et retrouver les mêmes octets veut dire que la page était juste — il n'y a
     ni panne ni réparation à annoncer. */
  const c = conclure({ depot: "triage", testOk: true, testSortie: vert,
    aDocs: true, temoinValide: false, pagesOk: true, paquetChange: false });
  assert.deepEqual(c.soucis, []);
  assert.deepEqual(c.reparations, []);
});

test("un dépôt sans docs/ n'est jugé que sur sa suite", () => {
  const c = conclure({ depot: "identite", testOk: true, testSortie: "ℹ pass 22\n", aDocs: false, temoinValide: false });
  assert.deepEqual(c.soucis, []);
  assert.doesNotMatch(c.etat, /paquet/);
  assert.match(c.etat, /22 tests/);
});

test("deux pannes simultanées sont toutes deux rapportées", () => {
  /*
   * Le défaut d'origine : l'outil s'arrêtait au premier problème, on réparait, on relançait,
   * on découvrait le deuxième. Quatre allers-retours pour ce qui tient en un rapport.
   */
  const c = conclure({ depot: "cycle", testOk: false, testSortie: rouge,
    aDocs: true, temoinValide: false, pagesOk: false, pagesSortie: "build cassé\n" });
  assert.equal(c.soucis.length, 2, "une des deux pannes a été avalée");
  assert.deepEqual(c.soucis.map((s) => s.quoi).sort(), ["npm run pages", "npm test"]);
});

test("un compte de tests illisible ne fait pas passer le dépôt pour sain", () => {
  const c = conclure({ depot: "inconnu", testOk: true, testSortie: "aucune ligne de compte\n",
    aDocs: false, temoinValide: false });
  assert.match(c.etat, /\? tests/, "un compte manquant doit se voir, pas se deviner");
});

test("l'ordre documenté est celui que le code exécute", () => {
  /*
   * PROPAGATION.md décrit l'ordre obligatoire des trois mécanismes. C'est de la prose, et
   * une prose qui décrit du code est une prose qui finira par mentir — c'est exactement le
   * défaut que la journée entière a consisté à fermer sur les chiffres, reproduit un cran
   * plus haut le soir même.
   *
   * On extrait la chaîne du document et on vérifie que les appels apparaissent dans cet
   * ordre dans la source. Ce n'est pas une preuve d'exécution, c'est mieux que rien et ça
   * tombe le jour où l'un des deux bouge sans l'autre.
   */
  const doc = new URL("../../identite/PROPAGATION.md", import.meta.url).pathname;
  if (!existsSync(doc)) return;
  const bloc = /```\n([^`]*?)\n```/.exec(readFileSync(doc, "utf8"))?.[1] ?? "";
  const etapes = bloc.split("→").map((x) => x.trim()).filter(Boolean)
    .map((x) => x.replace(/\s*\(.*\)\s*/, "").trim());
  assert.ok(etapes.length >= 4, `l'ordre documenté est illisible : ${JSON.stringify(bloc)}`);

  const source = readFileSync(new URL("./portefeuille.ts", import.meta.url).pathname, "utf8");
  /* Le nom de l'étape dans le document → ce qu'on cherche dans le code. */
  const marqueurs: Record<string, RegExp> = {
    diffuser: /diffuser\.mjs/,
    emprunter: /"emprunter"/,
    "npm test par dépôt": /"npm", \["test"\]|"npm", \["test"\]/,
    mesurer: /"run", "mesurer"/,
    prose: /"run", "prose"/,
    boucler: /tours < 4|for \(; tours/,
  };
  let position = -1;
  for (const etape of etapes) {
    const motif = marqueurs[etape];
    assert.ok(motif, `l'étape « ${etape} » du document ne correspond à rien de connu du code`);
    const trouve = source.search(motif);
    assert.ok(trouve > -1, `l'étape « ${etape} » est documentée et introuvable dans le code`);
    assert.ok(trouve > position,
      `« ${etape} » apparaît dans le code avant l'étape qui le précède dans PROPAGATION.md — `
      + `le document et le code décrivent deux ordres différents`);
    position = trouve;
  }
});

/* ── ce qu'il fait vraiment, sur un faux portfolio où l'on casse ce qu'on veut ── */

/** Un dépôt minuscule : un package.json, un test qui passe ou non, un docs/ optionnel. */
function faireDepot(racine: string, nom: string, o: { testPasse?: boolean; docs?: boolean } = {}) {
  const d = `${racine}${nom}/`;
  mkdirSync(d + "src", { recursive: true });
  writeFileSync(d + "package.json", JSON.stringify({
    name: nom, private: true, type: "module",
    scripts: { test: "node --test src/*.test.ts", pages: "node src/pages.mjs" },
  }, null, 2));
  writeFileSync(d + "src/x.test.ts",
    `import { test } from "node:test";\nimport assert from "node:assert/strict";\n`
    + `test("un cas", () => { assert.equal(1, ${o.testPasse === false ? 2 : 1}); });\n`);
  if (o.docs) {
    mkdirSync(d + "docs", { recursive: true });
    writeFileSync(d + "docs/index.html", "<!doctype html><html><body>ancien</body></html>");
    /* Un `pages` qui recopie la version courante de src/ vers docs/ — assez pour que
       « le paquet a changé » veuille dire quelque chose. */
    writeFileSync(d + "src/pages.mjs",
      `import { readFileSync, writeFileSync } from "node:fs";\n`
      + `writeFileSync(new URL("../docs/index.html", import.meta.url).pathname,\n`
      + `  "<!doctype html><html><body>" + readFileSync(new URL("./version.txt", import.meta.url).pathname, "utf8") + "</body></html>");\n`);
    writeFileSync(d + "src/version.txt", "nouveau");
  }
  return d;
}

test("un portfolio sain ne produit aucun souci", async () => {
  const racine = mkdtempSync(join(tmpdir(), "porte-")) + "/";
  try {
    faireDepot(racine, "alpha");
    faireDepot(racine, "beta");
    const r = await tour({ voisins: racine, ici: racine + "alpha/", depots: ["alpha", "beta"], silencieux: true });
    assert.deepEqual(r.soucis, [], `soucis inattendus : ${JSON.stringify(r.soucis)}`);
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test("une suite en échec est détectée, et nommée", async () => {
  /* La propriété la plus élémentaire, et celle que rien ne vérifiait : est-ce que l'outil
     qui juge douze dépôts sait reconnaître un dépôt qui va mal. */
  const racine = mkdtempSync(join(tmpdir(), "porte-")) + "/";
  try {
    faireDepot(racine, "alpha");
    faireDepot(racine, "casse", { testPasse: false });
    const r = await tour({ voisins: racine, ici: racine + "alpha/", depots: ["alpha", "casse"], silencieux: true });
    assert.equal(r.soucis.length, 1, "la suite en échec n'a pas été vue");
    assert.equal(r.soucis[0]!.ou, "casse");
    assert.equal(r.soucis[0]!.quoi, "npm test");
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test("un paquet publié périmé est reconstruit et signalé comme réparation", async () => {
  const racine = mkdtempSync(join(tmpdir(), "porte-")) + "/";
  try {
    faireDepot(racine, "alpha");
    faireDepot(racine, "vieux", { docs: true });
    const r = await tour({ voisins: racine, ici: racine + "alpha/", depots: ["alpha", "vieux"], silencieux: true });
    assert.deepEqual(r.soucis, [], `un paquet périmé doit être une réparation, pas un souci : ${JSON.stringify(r.soucis)}`);
    assert.ok(r.reparations.some((x) => /vieux/.test(x.quoi)), "la reconstruction n'a pas été rapportée");
    assert.match(readFileSync(racine + "vieux/docs/index.html", "utf8"), /nouveau/,
      "le paquet n'a pas été reconstruit");
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test("un second tour ne reconstruit plus rien", async () => {
  /* Le témoin doit tenir : reconstruire douze paquets à chaque tour rend le contrôle lent,
     et un contrôle lent cesse d'être lancé. */
  const racine = mkdtempSync(join(tmpdir(), "porte-")) + "/";
  try {
    faireDepot(racine, "alpha");
    faireDepot(racine, "stable", { docs: true });
    const o = { voisins: racine, ici: racine + "alpha/", depots: ["alpha", "stable"], silencieux: true };
    await tour(o);
    const second = await tour(o);
    assert.deepEqual(second.reparations, [], "le second tour a rebâti un paquet inchangé");
    assert.ok(second.lignes.some((l) => /paquet à jour/.test(l)));
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

test("deux dépôts cassés sont tous deux rapportés", async () => {
  const racine = mkdtempSync(join(tmpdir(), "porte-")) + "/";
  try {
    faireDepot(racine, "alpha");
    faireDepot(racine, "un", { testPasse: false });
    faireDepot(racine, "deux", { testPasse: false });
    const r = await tour({ voisins: racine, ici: racine + "alpha/", depots: ["alpha", "un", "deux"], silencieux: true });
    assert.equal(r.soucis.length, 2, "l'outil s'est arrêté au premier problème");
    assert.deepEqual(r.soucis.map((s) => s.ou).sort(), ["deux", "un"]);
  } finally { rmSync(racine, { recursive: true, force: true }); }
});

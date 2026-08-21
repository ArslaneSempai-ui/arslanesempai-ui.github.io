/*
 * CE QUE LES README AFFIRMENT EN PROSE.
 *
 * Les blocs entre `<!-- figures:… -->` sont générés depuis les modèles et tenus par
 * `readme.ts --check`. Tout le reste est écrit à la main, et c'est là que les six README
 * mentaient — de la même façon, tous les six : **chacun sous-estimait son propre nombre de
 * tests**, de 27 pour 47, de 11 pour 16, de 7 pour 12. Le chiffre vit dans un commentaire
 * de bloc `bash`, à un centimètre du bloc généré, et aucun contrôle ne l'avait jamais
 * regardé.
 *
 * Deuxième forme, plus embarrassante encore : `npm run demo` chez la recherche
 * documentaire, alors que le script s'appelle `demande`. Un lecteur qui suit le README à
 * la lettre reçoit « Missing script ». C'est la première chose qu'un inconnu essaie.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { PAGES } from "./prose.ts";
import { DEPOTS } from "./compter.ts";

const VOISINS = new URL("../../", import.meta.url).pathname;

/*
 * LA LISTE VIENT DE `depots.json`, COMME TOUTES LES AUTRES.
 *
 * Elle était écrite ici à la main — sept dépôts — et elle avait déjà dérivé de trois :
 * `arbitrage`, `derive` et `remediation` n'y étaient pas, donc leurs README n'étaient
 * surveillés par rien. C'était le dernier endroit du portfolio où une liste de dépôts vivait
 * à la main, après `diffuser.mjs` et `compter.ts` le 21 août 2026.
 *
 * Rien ici n'écrit, donc la dérive ne coûtait pas un dépôt écrasé : elle coûtait un contrôle
 * qui passe en ayant regardé moins que ce qu'il prétend. Les cas ci-dessous sautent déjà ce
 * qui n'a ni README ni comptage, donc élargir la liste ne fait qu'élargir la couverture.
 */

const chiffres = () => JSON.parse(readFileSync(new URL("../chiffres.json", import.meta.url).pathname, "utf8"));

const readme = (d: string) => `${VOISINS}${d}/README.md`;
const paquet = (d: string) => `${VOISINS}${d}/package.json`;

test("toute commande citée dans un README existe", () => {
  const morts: string[] = [];
  for (const d of DEPOTS) {
    if (!existsSync(readme(d)) || !existsSync(paquet(d))) continue;
    const scripts = new Set(Object.keys(JSON.parse(readFileSync(paquet(d), "utf8")).scripts ?? {}));
    const citees = new Set([...readFileSync(readme(d), "utf8").matchAll(/npm run ([a-zA-Z][\w:-]*)/g)]
      .map((m) => m[1]!));
    for (const c of citees) if (!scripts.has(c)) morts.push(`${d} : npm run ${c}`);
  }
  assert.deepEqual(morts, [], `commande(s) citées et inexistantes — ${morts.join(" · ")}`);
});

test("chaque README annonce son vrai nombre de tests", (t) => {
  /*
   * Le compte vient du relevé de `npm run compter`, pas d'une exécution : relancer sept
   * suites depuis un test en coûterait quatre-vingts secondes à chaque `npm test`. Le
   * contrôle de péremption vit dans profil.test.ts et vaut pour celui-ci aussi.
   */
  const par = chiffres().portfolio?.parDepot;
  if (!par) return t.skip("aucun comptage enregistré — lancer `npm run compter`");
  const faux: string[] = [];
  for (const d of DEPOTS) {
    if (!existsSync(readme(d)) || par[d] == null) continue;
    const texte = readFileSync(readme(d), "utf8");
    const dit = /and (\d+) tests\b/.exec(texte)?.[1];
    if (dit === undefined) continue;   // ce README ne fait pas la promesse
    if (Number(dit) !== par[d]) faux.push(`${d} annonce ${dit}, en a ${par[d]}`);
  }
  assert.deepEqual(faux, [], faux.join(" · "));
});

test("aucune page marquée n'échappe à la liste surveillée", () => {
  /*
   * La liste était tenue à la main, et elle a dérivé sans bruit : quatre README portaient des
   * marques de provenance que personne ne rafraîchissait. Celui de cascade annonçait 22 tests
   * quand il y en avait 54 — juste le jour où le chiffre a été écrit, faux tous les autres.
   *
   * Une liste écrite à la main dans un outil qui existe pour empêcher les chiffres écrits à la
   * main : le contrôle manquait exactement là où l'outil regarde.
   */
  const racine = new URL("../../", import.meta.url).pathname;
  const marquees = execFileSync("grep",
    ["-rl", "--include=*.md", "<!--p:", "."],
    { cwd: racine, encoding: "utf8" })
    .split("\n").filter(Boolean)
    .map((c) => c.replace(/^\.\//, ""))
    .filter((c) => !c.includes("node_modules"))
    .sort();

  const oubliees = marquees.filter((c) => !PAGES.includes(c));
  assert.deepEqual(oubliees, [],
    `page(s) portant des marques et non surveillées : ${oubliees.join(", ")}\n`
    + `  → leurs chiffres ne sont jamais rafraîchis, et rien ne le dit.`);
});

test("aucun dépôt ne prétend être testé sans l'être", () => {
  /*
   * `recon` portait un script `npm test` qui lance `node --test src/*.test.ts` — et pas un
   * seul fichier de test. La commande existait, la promesse aussi, la vérification non.
   *
   * C'est pire qu'un dépôt non compté : un dépôt non compté se voit dans un total, un dépôt
   * qui annonce une suite vide passe pour vérifié. Le contrôle liste ceux qui promettent sans
   * tenir, pour qu'on décide — les finir, ou retirer la promesse.
   */
  /*
   * Une exception déclarée n'est pas un oubli.
   *
   * Ces deux-là sont connus et leur sort n'est pas tranché. Les écrire ici avec leur raison
   * les garde visibles ; les laisser sortir du contrôle les rendrait invisibles, ce qui est
   * exactement l'état d'où ils viennent.
   */
  const CONNUS: Record<string, string> = {
    recon: "outil inachevé — la commande test existe, la suite n'a jamais été écrite ; à finir ou à retirer",
    outreach: "outil en pause depuis l'alerte LinkedIn — même promesse vide, même décision en attente",
  };

  const racine = new URL("../../", import.meta.url).pathname;
  const menteurs: string[] = [];
  for (const e of readdirSync(racine, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
    const d = `${racine}${e.name}/`;
    if (!existsSync(d + "package.json")) continue;
    let pkg: any;
    try { pkg = JSON.parse(readFileSync(d + "package.json", "utf8")); } catch { continue; }
    if (!pkg.scripts?.test) continue;
    const cherche = (x: string) => {
      try { return readdirSync(x).some((f) => /\.test\.(ts|mjs|js)$/.test(f)); } catch { return false; }
    };
    const teste = cherche(d) || cherche(d + "src");
    if (!teste && !(e.name in CONNUS)) menteurs.push(e.name);
  }
  assert.deepEqual(menteurs, [],
    `dépôt(s) avec une commande \`test\` et aucun fichier de test : ${menteurs.join(", ")}\n`
    + `  → soit écrire la suite, soit retirer le script, soit le déclarer dans CONNUS avec sa raison.\n`
    + `    Une promesse vide est pire qu'aucune promesse.`);
});

test("le tour du portfolio a été lancé récemment", () => {
  /*
   * Le contrôle qui n'est déclenché par rien.
   *
   * `portefeuille` fait le tour complet et personne n'est obligé de le lancer. C'est
   * exactement l'écart entre une note en mémoire et un test : la note attend qu'on se la
   * rappelle, le test se déclenche tout seul. Un contrôle qu'on doit penser à lancer est une
   * note déguisée.
   *
   * Ce test-ci ne fait pas le tour — il serait trois minutes dans une suite qui en dure
   * dix-huit secondes. Il vérifie qu'il a eu lieu, et périme au bout d'une semaine : assez
   * long pour ne pas harceler, assez court pour qu'une dérive ne s'installe pas.
   */
  const temoin = new URL("../data/dernier-tour.txt", import.meta.url).pathname;
  const JOURS = 7;
  if (!existsSync(temoin)) {
    assert.fail("le tour du portfolio n'a jamais été lancé — `npm run portefeuille`");
  }
  const quand = new Date(readFileSync(temoin, "utf8").trim());
  const jours = (Date.now() - quand.getTime()) / 86_400_000;
  assert.ok(jours <= JOURS,
    `dernier tour du portfolio il y a ${jours.toFixed(0)} jours — `
    + `au-delà de ${JOURS}, une dérive a le temps de s'installer. Lancer \`npm run portefeuille\`.`);
});

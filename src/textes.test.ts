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
import { readFileSync, existsSync } from "node:fs";

const VOISINS = new URL("../../", import.meta.url).pathname;
const DEPOTS = ["economics", "triage", "funnel", "cycle", "banc", "rag", "vitrine"];
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

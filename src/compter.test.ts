/*
 * LA DÉCOUVERTE DES DÉPÔTS NE DOIT SERVIR QUE CE QUI EST INSCRIT.
 *
 * `decouvrirDepots` balayait `~/Documents` et gardait tout dossier ressemblant à un dépôt.
 * `compter()` lance `npm test` chez chacun et `portefeuille.ts` y lance `npm run pages` et
 * `npm run emprunter`, qui écrivent. `cascade` passait le filtre — une autre session y
 * travaille, avec des commits en avance sur origin — donc une seule commande écrivait dans un
 * dépôt tenu par quelqu'un d'autre. Deux écritures concurrentes ne lèvent rien : elles
 * divergent.
 *
 * `diffuser.mjs` avait le même défaut et il a été corrigé par une liste explicite. Le trou
 * est ressorti ici parce qu'on avait réparé un appelant et non le mécanisme.
 *
 * Trois propriétés, et la troisième est celle qu'on oublie : **ne pas servir ce qui n'est pas
 * inscrit**, **ne pas se taire sur ce qu'on écarte**, et **refuser un zéro sans témoin**.
 *
 * Tout tourne sur un faux portfolio en dossier temporaire — jamais sur l'arbre réel, qui est
 * précisément ce que cette fonction protège.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decouvrirDepots } from "./compter.ts";

const VRAIE_LISTE = new URL("../../identite/depots.json", import.meta.url).pathname;

/** Un faux portfolio : des dossiers qui ressemblent à des dépôts, et une liste à part. */
function portfolio(noms: string[], declare: { diffusion: string[]; exclus?: Record<string, unknown> }) {
  const racine = mkdtempSync(join(tmpdir(), "depots-")) + "/";
  assert.ok(!racine.includes("/Documents/"),
    `terrain d'essai dans le vrai arbre : ${racine}`);
  for (const nom of noms) {
    mkdirSync(racine + nom + "/src", { recursive: true });
    writeFileSync(`${racine}${nom}/package.json`, JSON.stringify({ scripts: { test: "node --test" } }));
    writeFileSync(`${racine}${nom}/src/quelque-chose.test.ts`, "");
  }
  const liste = racine + "depots.json";
  writeFileSync(liste, JSON.stringify(declare));
  return {
    racine, liste,
    trouver: (ici = "vitrine") => decouvrirDepots(racine, liste, ici, `${racine}${ici}/`),
    nettoyer: () => rmSync(racine, { recursive: true, force: true }),
  };
}

test("un dossier inscrit est compté, un dossier exclu ne l'est pas", () => {
  /* liste-figee: noms de montage, pas un périmètre. Ils coïncident volontairement avec de
     vrais dépôts pour que le cas ressemble au portfolio réel — mais l'arbre est temporaire et
     la liste passée en paramètre, donc rien ici ne fige ce que le code regarde en vrai. */
  const p = portfolio(["vitrine", "banc", "reserve"],
    { diffusion: ["vitrine", "banc"], exclus: { reserve: { pourquoi: "essai", depuis: "2026-08-21" } } });
  try {
    assert.deepEqual(p.trouver(), ["banc", "vitrine"]);
  } finally { p.nettoyer(); }
});

test("un dossier qui ressemble à un dépôt sans être inscrit fait tomber la commande", () => {
  /* Ni servi ni ignoré : nommé. C'est ce qui remplace le balayage — un dépôt oublié se
     découvre toujours, mais en se signalant plutôt qu'en se faisant écrire dessus. */
  const p = portfolio(["vitrine", "surprise"], { diffusion: ["vitrine"] });
  try {
    assert.throws(() => p.trouver(), (e: Error) => {
      assert.match(e.message, /surprise/, "le dossier inconnu n'est pas nommé");
      assert.match(e.message, /depots\.json/, "le message doit dire où inscrire le dossier");
      assert.match(e.message, /npm run pages/, "le message doit dire ce qui tournerait chez lui");
      return true;
    });
  } finally { p.nettoyer(); }
});

test("un dossier sans les marqueurs d'un dépôt n'est pas un oubli", () => {
  /* Ne signaler que ce qui ressemble à un dépôt : sinon chaque dossier de ~/Documents ferait
     tomber la commande, le signal deviendrait du bruit, et on le désactiverait. */
  const p = portfolio(["vitrine"], { diffusion: ["vitrine"] });
  try {
    mkdirSync(p.racine + "notes/sous", { recursive: true });
    writeFileSync(p.racine + "notes/lisezmoi.md", "rien");
    assert.deepEqual(p.trouver(), ["vitrine"]);
  } finally { p.nettoyer(); }
});

test("aucun dépôt inscrit trouvé : on refuse le zéro au lieu de le rendre", () => {
  /*
   * Un relevé cassé — mauvais chemin, mauvaise racine — rendrait une liste vide exactement
   * comme un portfolio vide. Le 21 août 2026 un relevé écrit à la main a rendu « zéro dossier
   * porteur » parce que zsh ne découpe pas un paramètre non quoté, et seul un témoin l'a
   * démasqué.
   */
  const p = portfolio(["reserve"], { diffusion: ["banc"], exclus: { reserve: { pourquoi: "x", depuis: "2026-08-21" } } });
  try {
    assert.throws(() => p.trouver("absent"), /aucun dépôt inscrit/);
  } finally { p.nettoyer(); }
});

test("liste illisible : on tombe, on ne retombe pas sur un balayage", () => {
  const p = portfolio(["vitrine"], { diffusion: ["vitrine"] });
  try {
    assert.throws(() => decouvrirDepots(p.racine, p.racine + "inexistant.json", "vitrine", p.racine + "vitrine/"),
      /liste des dépôts est illisible/);
  } finally { p.nettoyer(); }
});

test("la vraie liste écarte bien cascade, et compte identite", () => {
  /*
   * Un zéro qui ne prouve rien : les cas ci-dessus tournent sur des listes d'essai. Si le
   * vrai fichier n'excluait plus rien, ils passeraient tout autant.
   */
  const vraie = JSON.parse(readFileSync(VRAIE_LISTE, "utf8"));
  assert.ok("cascade" in (vraie.exclus ?? {}), "cascade doit rester hors de portée");
  assert.ok(!vraie.diffusion.includes("cascade"), "cascade ne doit pas être inscrit");
  assert.ok(vraie.diffusion.length >= 10, `seulement ${vraie.diffusion.length} dépôt(s) inscrits`);
  /* `identite` est la source : absente de `diffusion`, mais comptée — elle porte la couche
     partagée et ses tests, et les oublier a déjà faussé le total publié. */
  assert.ok(!vraie.diffusion.includes("identite"), "identite est la source, pas une cible de diffusion");
  assert.ok(decouvrirDepots().includes("identite"), "identite doit être comptée malgré tout");
});

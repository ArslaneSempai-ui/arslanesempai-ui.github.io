/*
 * UNE CLÉ N'EST PAS UN CHEMIN, ET « rag » LE PROUVE.
 *
 * `pages.ts` déclare `cle: "rag"` pour la recherche documentaire **publique**, dont le dossier
 * local est `rag-vitrine`. Or il existe un dossier `rag` juste à côté : c'est le dépôt
 * **gardé privé**. Un code qui déduirait le dossier de la clé — `${VOISINS}${cle}/` — irait
 * lire le dépôt fermé en croyant lire la démo, et un README publié pourrait finir par pointer
 * vers un dépôt que personne d'extérieur ne peut ouvrir.
 *
 * ─── Ce que le relevé du 22 août 2026 a trouvé, et ce qu'il n'a pas trouvé ───
 *
 * Quarante-quatre correspondances nom → chemin sont déclarées dans le portfolio. **Une seule**
 * a une clé qui n'est pas son dossier, et c'est celle-ci. Il n'y en a pas de seconde : ce
 * fichier ne garde donc pas un motif observé deux fois, il garde un accident unique dont le
 * coût est asymétrique.
 *
 * Ce qui justifie quand même un gardien : **six endroits** doivent trancher indépendamment
 * quel `rag` ils désignent — `pages.ts`, `mesurer.ts`, `depots.json`, `chiffres.json`,
 * `vitrine.test.ts` et `liens.test.ts`. Les six sont justes aujourd'hui, et un seul porte un
 * commentaire qui l'explique. Six pièces qui doivent rester d'accord sur un désaccord, sans
 * que rien ne le dise, est précisément ce qui casse le jour où quelqu'un range.
 *
 * Et le désaccord est **voulu** : `mesurer.ts` mesure le modèle, qui vit dans le dépôt privé ;
 * `pages.ts` publie la démo, qui vit dans le public. Unifier les deux casserait l'un ou
 * l'autre — mesurer un dossier sans modèle, ou publier un lien vers un dépôt fermé.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const VOISINS = new URL("../../", import.meta.url).pathname;
const lire = (f: string) => readFileSync(new URL(f, import.meta.url).pathname, "utf8");
/*
 * ─── LE DÉPÔT CLONÉ SEUL ───
 *
 * Ces cas comparent la vitrine à ses voisins. Sur un clone isolé — ce qu'un visiteur obtient
 * en premier — les voisins n'existent pas, et jusqu'au 22 août 2026 la suite échouait à la
 * première commande. Un dépôt de démonstration dont les tests cassent tout de suite annonce
 * qu'on ne les a jamais essayés.
 *
 * On saute donc, **en le disant** : un saut nommé est un résultat, un saut muet est un vert
 * vide. Le signal est la liste elle-même — si `identite/depots.json` est hors de portée, il
 * n'y a pas de portfolio autour, et ces questions n'ont pas d'objet.
 */
const SEUL = !existsSync(new URL("../../identite/depots.json", import.meta.url).pathname);
const siSeul = (t: { skip: (m: string) => void }) =>
  SEUL && (t.skip("dépôt cloné seul — les voisins ne sont pas là, ces cas n'ont pas d'objet"), true);


/**
 * Toute paire `cle: "x", dossier: "y"` déclarée dans un fichier.
 *
 * La classe de caractères accepte tout ce qu'un nom de dossier peut porter, et pas seulement
 * les minuscules et le tiret. La première version s'arrêtait à `[a-z-]` : essayant de prouver
 * ce fichier en renommant `banc` en `_banc` — un dossier qui existe pour de vrai dans
 * `~/Documents` — la paire cessait simplement d'être vue, et le contrôle passait au vert sur
 * la faute qu'on venait d'introduire. Exiger une forme plutôt qu'une propriété, une fois de
 * plus : c'est ce que la cassure a montré, pas la lecture.
 */
function correspondances(fichier: string): Record<string, string> {
  return Object.fromEntries(
    [...lire(fichier).matchAll(/cle: "([^"]+)", dossier: "([^"]+)"/g)].map((m) => [m[1]!, m[2]!]));
}

/**
 * liste-figee: les clés dont le dossier n'est pas le nom. C'est le sujet même de ce fichier —
 * la déduire du disque supprimerait ce qu'elle sert à retenir. Une clé qui s'y ajoute doit
 * être écrite ici avec sa raison, ce qui force à la regarder.
 */
const TROMPEUSES: Record<string, { dossier: string; pourquoi: string; depuis: string }> = {
  rag: {
    dossier: "rag-vitrine",
    pourquoi: "la démo publiée de la recherche documentaire vit dans rag-vitrine ; le dossier "
      + "rag est le dépôt gardé privé, et une déduction depuis la clé irait le lire",
    depuis: "2026-08-22",
  },
};

test("le relevé porte sur des correspondances — sinon il ne prouve rien", () => {
  const n = Object.keys(correspondances("./pages.ts")).length
    + Object.keys(correspondances("./mesurer.ts")).length;
  assert.ok(n >= 15, `seulement ${n} correspondance(s) lue(s) : le motif de recherche est périmé`);
});

test("tout dossier déclaré existe vraiment", (t) => {
  if (siSeul(t)) return;
  const absents: string[] = [];
  for (const f of ["./pages.ts", "./mesurer.ts"]) {
    for (const [cle, dossier] of Object.entries(correspondances(f))) {
      if (!existsSync(`${VOISINS}${dossier}`)) absents.push(`${f} : ${cle} → ${dossier}`);
    }
  }
  assert.deepEqual(absents, [], `dossier(s) déclarés et introuvables : ${absents.join(", ")}`);
});

test("une clé qui n'est pas son dossier est déclarée trompeuse", () => {
  /*
   * Le cœur. Une clé neuve dont le dossier diffère fait tomber ce cas, et son auteur doit
   * l'inscrire ci-dessus — donc la regarder, donc décider si elle vise le bon dossier.
   */
  const nues: string[] = [];
  for (const f of ["./pages.ts", "./mesurer.ts"]) {
    for (const [cle, dossier] of Object.entries(correspondances(f))) {
      if (cle === dossier) continue;
      if (TROMPEUSES[cle]?.dossier !== dossier) nues.push(`${f} : ${cle} → ${dossier}`);
    }
  }
  assert.deepEqual(nues, [],
    `${nues.join(", ")} — une clé dont le dossier n'est pas le nom doit être inscrite dans `
    + `TROMPEUSES avec sa raison. Vérifier d'abord qu'elle ne vise pas un dépôt privé.`);
});

test("l'exception s'exerce : le dossier homonyme existe et diffère", (t) => {
  if (siSeul(t)) return;
  /*
   * Une exception qui ne sert plus est pire qu'aucune : elle se lit comme une protection en
   * place. Si le dossier `rag` disparaissait, cette entrée n'aurait plus d'objet et devrait
   * être retirée plutôt que de continuer à avertir d'un piège qui n'existe plus.
   */
  for (const [cle, v] of Object.entries(TROMPEUSES)) {
    assert.ok(existsSync(`${VOISINS}${cle}`),
      `${cle} : plus aucun dossier de ce nom — l'exception ne garde plus rien, la retirer`);
    assert.notEqual(cle, v.dossier, `${cle} : la clé et le dossier sont identiques, l'entrée est vide`);
    assert.ok(v.pourquoi.length > 30, `${cle} : une exception sans raison écrite ne se relit pas`);
    assert.match(v.depuis, /^\d{4}-\d{2}-\d{2}$/, `${cle} : sans date, l'exception vieillit en silence`);
  }
});

test("le désaccord entre pages et mesurer est voulu, et le rester", (t) => {
  if (siSeul(t)) return;
  /*
   * `mesurer.ts` mesure le modèle, qui vit dans le dépôt privé ; `pages.ts` publie la démo,
   * qui vit dans le public. Les deux sont justes et ils ne peuvent pas être unifiés : mesurer
   * `rag-vitrine` ne trouverait aucun modèle, publier `rag` pointerait vers un dépôt fermé.
   * Ce cas tombe si quelqu'un les aligne, et lui dit pourquoi ne pas le faire.
   */
  assert.equal(correspondances("./pages.ts").rag, "rag-vitrine",
    "pages.ts publie la démo : son dossier doit être le public");
  assert.equal(correspondances("./mesurer.ts").rag, "rag",
    "mesurer.ts mesure le modèle : son dossier doit être le privé, où le modèle vit");
  assert.ok(existsSync(`${VOISINS}rag/src/index.ts`),
    "le modèle mesuré n'est plus là où mesurer.ts le cherche");
});

test("aucun code ne déduit un dossier voisin d'une clé", () => {
  /*
   * L'autre moitié : les déclarations peuvent être justes et un code aller quand même chercher
   * `${VOISINS}${cle}/`. On refuse l'interpolation d'une variable nommée `cle` dans un chemin
   * voisin — c'est la seule forme mécaniquement reconnaissable de la faute.
   */
  const fautifs: string[] = [];
  for (const f of readdirSync(new URL(".", import.meta.url).pathname)) {
    if (!/\.(ts|mjs)$/.test(f) || f === "chemins.test.ts") continue;
    const code = lire("./" + f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    if (/\$\{VOISINS\}\$\{[a-z.]*cle\}/.test(code)) fautifs.push(f);
  }
  assert.deepEqual(fautifs, [],
    `${fautifs.join(", ")} construit un chemin voisin depuis une clé — passer par le champ `
    + `\`dossier\`, qui est déclaré précisément parce que les deux diffèrent.`);
});

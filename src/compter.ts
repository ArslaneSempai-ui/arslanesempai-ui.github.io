import { fileURLToPath } from "node:url";
/*
 * COMBIEN DE TESTS, ET DEPUIS QUAND.
 *
 * La page d'accueil du profil annonce un nombre de tests. C'est le seul README du
 * portfolio écrit à la main — les six autres sont générés depuis leurs modèles et tenus
 * par `readme.ts --check`. Résultat prévisible : il affirmait « 147 tests » alors qu'il y
 * en avait 167, sur la première page que lit un recruteur, et rien n'aurait jamais signalé
 * l'écart.
 *
 * Compter les tests sans les exécuter ne marche pas : un `grep` sur `test(` en trouve 187,
 * parce qu'il attrape les occurrences dans les chaînes et les commentaires. Le seul compte
 * juste est celui que le lanceur rapporte. Il coûte quatre-vingts secondes, ce qui est trop
 * pour chaque `npm test` — donc on mesure sur demande, on écrit le résultat avec sa date,
 * et un test bon marché vérifie deux choses : que le README dit ce nombre-là, et qu'aucun
 * dépôt n'a commité de test depuis la mesure. La seconde est ce qui empêche le chiffre de
 * vieillir en silence, sans avoir à relancer quoi que ce soit.
 */

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { isMain } from "./cli.ts";

const VOISINS = fileURLToPath(new URL("../../", import.meta.url));
/* La liste des dépôts, tenue une seule fois, dans `identite`. Voir `decouvrirDepots`. */
const LISTE = fileURLToPath(new URL("../../identite/depots.json", import.meta.url));
const CHIFFRES = fileURLToPath(new URL("../chiffres.json", import.meta.url));

/**
 * Un dépôt a-t-il des tests, quelle que soit la forme qu'ils prennent.
 *
 * La première version cherchait `src/*.test.ts` et rien d'autre. `identite` range ses tests à
 * la racine et les écrit en `.mjs` — donc la couche partagée du portfolio, celle que douze
 * dépôts recopient, passait pour non testée et sortait du compte.
 *
 * ─── RÉÉCRITE le 21 août 2026, et il faut le dire ───
 *
 * En remplaçant `decouvrirDepots` juste en dessous, j'ai supprimé cette fonction avec le bloc
 * qui l'entourait. Elle faisait partie de modifications non committées, donc git n'en avait
 * aucune copie et il n'en existait aucune ailleurs sur le disque. Le corps ci-dessous est
 * reconstitué depuis son en-tête et les trois premières lignes que j'avais lues : il cherche
 * les deux formes de nom, à la racine et sous `src/`, et rend faux plutôt que de lever sur un
 * dossier illisible. Le comportement décrit est tenu par le test — mais si l'intention
 * d'origine était plus large, c'est ici qu'il faut la remettre.
 */
function aDesTests(dossier: string): boolean {
  const cherche = (d: string) => {
    try {
      return readdirSync(d).some((f) => /\.test\.(ts|mjs|js)$/.test(f));
    } catch { return false; }
  };
  return cherche(dossier) || cherche(dossier + "src/");
}

/**
 * LES DÉPÔTS COMPTÉS — LUS DANS LA MÊME LISTE QUE LA DIFFUSION.
 *
 * Cette fonction balayait `~/Documents` et gardait tout voisin ayant un `package.json`, un
 * script `test` et des tests. Le motif était le bon — une liste écrite à la main avait déjà
 * dérivé, `recon` ayant des tests sans être compté — mais le remède allait trop loin : un
 * balayage qui ramasse ce qu'il trouve ne demande l'avis de personne, et `IGNORES` est resté
 * vide.
 *
 * Ce que cela coûtait, le 21 août 2026 : `cascade` a un `package.json`, un script `test` et
 * huit fichiers de test, donc il entrait dans `DEPOTS`. Or `compter()` y lance `npm test` et
 * `portefeuille.ts` y lance `npm run pages` et `npm run emprunter`, qui **écrivent**. Une
 * autre session travaille dans ce dépôt, avec des commits en avance sur origin. Deux
 * écritures concurrentes ne lèvent rien : elles divergent, et l'écart se retrouve des heures
 * plus tard en accusant le mauvais dépôt.
 *
 * `diffuser.mjs` avait exactement ce défaut et il a été corrigé par une liste explicite.
 * Corriger l'appelant plutôt que le mécanisme aurait laissé le trou ressortir par la porte
 * suivante — c'est précisément ce qui s'est passé ici. La découverte lit donc **le même
 * fichier** que la diffusion, avec les mêmes exclusions nommées et datées.
 *
 * Trois états, et le troisième est celui qui compte :
 *
 *   - **inscrit** (`diffusion`, plus `identite` qui est la source et porte ses propres
 *     tests) : il est compté ;
 *   - **exclu** (`exclus`, avec sa raison et sa date) : il ne l'est pas ;
 *   - **ni l'un ni l'autre, mais portant les marqueurs d'un dépôt** : la commande TOMBE en le
 *     nommant. C'est ce qui remplace le balayage : un dépôt oublié se découvre toujours, mais
 *     en se faisant signaler plutôt qu'en se faisant servir.
 *
 * Et le témoin : si aucun dépôt inscrit ne ressort du disque, ce n'est pas un portfolio vide,
 * c'est un relevé qui ne lit rien — un zéro qui ne prouve rien se refuse.
 */
export function decouvrirDepots(
  voisins: string = VOISINS,
  liste: string = LISTE,
  /* Le dépôt courant, et son dossier. Paramétrés pour que les cas d'essai tournent sur un
     faux portfolio : un contrôle qui ne peut se vérifier que sur le vrai arbre est un
     contrôle qu'on finit par ne plus vérifier. */
  ici: string = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "").split("/").pop()!,
  dossierIci: string = fileURLToPath(new URL("..", import.meta.url)),
): string[] {

  let declare: { diffusion: string[]; exclus?: Record<string, unknown> };
  try {
    declare = JSON.parse(readFileSync(liste, "utf8"));
  } catch (e: any) {
    /*
     * ─── UN DÉPÔT CLONÉ SEUL N'EST PAS UNE PANNE ───
     *
     * Cette fonction levait dès que la liste était illisible, et c'était juste tant qu'on la
     * pensait toujours entourée de ses voisins : sans liste, la seule autre conduite serait de
     * balayer le disque, et un balayage écrit dans des dépôts que personne n'a inscrits.
     *
     * Mais elle levait **au chargement du module**, donc quatre fichiers de contrôle ne se
     * chargeaient même pas sur un clone isolé. Mesuré le 22 août 2026 : un clone de la vitrine,
     * seul dans un dossier vide, échouait 7 cas et 4 fichiers entiers. C'est le dépôt qu'un
     * visiteur clone en premier, et une suite qui casse à la première commande annonce qu'on ne
     * l'a jamais essayée.
     *
     * La distinction qui manquait : **liste absente ET des voisins autour** reste dangereux —
     * on pourrait balayer, donc on lève. **Liste absente ET aucun voisin** est simplement un
     * dépôt cloné seul : il n'y a rien à balayer, rien à protéger, et la seule réponse honnête
     * est de se rendre soi-même.
     */
    const combienDeVoisins = (() => {
      try {
        return readdirSync(voisins, { withFileTypes: true })
          .filter((x) => x.isDirectory() && !x.name.startsWith(".") && x.name !== ici).length;
      } catch { return 0; }
    })();
    if (combienDeVoisins === 0) return [ici];
    throw new Error(
      `la liste des dépôts est illisible (${liste}) : ${e.message}\n`
      + `  → elle est tenue dans identite/depots.json et partagée avec diffuser.mjs.\n`
      + `  → sans elle on ne devine pas la liste : un balayage écrirait dans des dépôts que personne n'a inscrits.`);
  }

  /* `identite` n'est pas dans `diffusion` — c'est la source, elle ne se diffuse pas à
     elle-même — mais elle porte cinquante tests et doit être comptée. Les deux listes ne
     répondent pas à la même question, et les confondre ferait disparaître la couche partagée
     du total, ce qui est déjà arrivé. */
  const admis = new Set<string>([...declare.diffusion, "identite"]);
  const exclus = new Set<string>(Object.keys(declare.exclus ?? {}));

  const dossierDe = (nom: string) => (nom === ici ? dossierIci : `${voisins}${nom}/`);

  const ressembleAUnDepot = (nom: string): boolean => {
    const d = dossierDe(nom);
    if (!existsSync(d + "package.json")) return false;
    try {
      const pkg = JSON.parse(readFileSync(d + "package.json", "utf8"));
      if (!pkg.scripts?.test) return false;
    } catch { return false; }
    return aDesTests(d);
  };

  const porteurs = readdirSync(voisins, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
    .map((e) => e.name)
    .filter(ressembleAUnDepot);

  const inconnus = porteurs.filter((n) => !admis.has(n) && !exclus.has(n)).sort();
  if (inconnus.length) {
    throw new Error(
      `${inconnus.length} dossier(s) ressemblent à un dépôt sans être inscrits : ${inconnus.join(", ")}\n`
      + `  → les ajouter à "diffusion" dans ${liste} s'ils doivent être comptés,\n`
      + `    à "exclus" avec une raison et une date sinon.\n`
      + `  → tant que le doute dure, rien ne tourne chez eux : compter y lance \`npm test\`,\n`
      + `    et le tour du portfolio y lance \`npm run pages\`, qui écrit.`);
  }

  const gardes = porteurs.filter((n) => admis.has(n));
  if (gardes.length === 0) {
    throw new Error(
      `aucun dépôt inscrit trouvé sous ${voisins}\n`
      + `  → ce n'est pas un portfolio vide, c'est un relevé qui ne lit rien.`);
  }
  return [...new Set([...gardes, ici])].sort();
}

export const DEPOTS = decouvrirDepots();

/**
 * Les fichiers non commités d'un dépôt, s'il y en a.
 *
 * COMPTER UN ARBRE QUI BOUGE PRODUIT UN CHIFFRE QU'AUCUN COMMIT NE CONTIENT. `compter()`
 * lance `npm test` chez le voisin et estampille le résultat avec `dernierTest(depot)` —
 * le dernier commit ayant touché un test. Si l'arbre porte des modifications non
 * commitées, le nombre mesuré vient d'un code que ce commit ne contient pas : le chiffre
 * publié est attribué à un état du dépôt qui n'existe nulle part.
 *
 * C'est la famille de défaut la plus chère de la journée — un chiffre dérivé de quelque
 * chose que git ne transporte pas — et elle est invisible depuis l'arbre de travail, par
 * construction : c'est l'arbre de travail qui est le problème.
 *
 * Le gardien de fraîcheur ne peut pas l'attraper non plus, et pour la même raison : il
 * compare des empreintes de commit, donc il ne voit que ce qui a été commité. Un test
 * modifié et non commité ne déplace aucune empreinte.
 *
 * On ne refuse donc pas tout le comptage : on refuse de CERTIFIER les dépôts concernés,
 * on les nomme, et le chiffre publié porte la liste. Refuser en bloc rendrait l'outil
 * inutilisable sur une machine où quelqu'un travaille toujours quelque part — et un outil
 * inutilisable se contourne, ce qui est pire que de ne pas l'avoir écrit.
 */
export function nonCommites(depot: string): string[] {
  const dossier = depot === "vitrine" ? fileURLToPath(new URL("..", import.meta.url)) : `${VOISINS}${depot}/`;
  if (!existsSync(dossier + ".git")) return [];
  try {
    return execFileSync("git", ["status", "--porcelain"], { cwd: dossier, encoding: "utf8" })
      .split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  } catch { return []; }
}

/** Le dernier commit qui a touché un fichier de test, par dépôt. */
export function dernierTest(depot: string): string | null {
  const dossier = depot === "vitrine" ? fileURLToPath(new URL("..", import.meta.url)) : `${VOISINS}${depot}/`;
  if (!existsSync(dossier + ".git")) return null;
  try {
    /*
     * Restreint aux fichiers de test : un commit qui touche un modèle ne périme pas un
     * compte de tests, et une alerte qui se déclenche à chaque commit n'est plus lue.
     *
     * Mais le motif était `src/*.test.ts`, plus étroit que ce que le compte mesure.
     * Le compte lance `npm test`, qui exécute aussi les `.mjs` — et `identite` range ses
     * tests à la racine, donc AUCUN fichier ne lui correspondait : la fonction rendait la
     * chaîne vide, le filtre écartait le dépôt, et le contrôle passait sans rien regarder.
     *
     * Mesuré le 22 août 2026 : onze estampilles sur onze étaient périmées et le gardien
     * était vert. Le nombre publié restait juste — la passe complète le confirmait — mais
     * plus rien ne pouvait le prouver, et c'est précisément ce que ce contrôle existe pour
     * faire. Le motif couvre maintenant tout fichier de test, à toute profondeur.
     */
    const sortie = execFileSync("git", ["log", "-1", "--format=%H", "--", "*.test.*"], {
      cwd: dossier, encoding: "utf8",
    }).trim();
    return sortie || null;
  } catch { return null; }
}

export function compter(): {
  nombre: number; parDepot: Record<string, number>; absents: string[];
  nonCertifies: Record<string, number>;
} {
  const parDepot: Record<string, number> = {};
  const absents: string[] = [];
  /** Dépôt → nombre de fichiers non commités qui empêchent de le certifier. */
  const nonCertifies: Record<string, number> = {};
  for (const depot of DEPOTS) {
    const dossier = depot === "vitrine" ? fileURLToPath(new URL("..", import.meta.url)) : `${VOISINS}${depot}/`;
    if (!existsSync(dossier + "package.json")) { absents.push(depot); continue; }
    const sales = nonCommites(depot);
    if (sales.length > 0) { nonCertifies[depot] = sales.length; continue; }
    let sortie = "";
    try {
      /*
       * Le contrôle de péremption ne doit pas bloquer la mesure qui le met à jour.
       *
       * Sans ça : `compter` refuse de compter une suite en échec, la suite de la vitrine
       * échoue parce que le comptage est périmé, et le comptage ne peut plus être refait.
       * Le test se met en pause pendant la mesure — il est sans objet à ce moment-là.
       */
      sortie = execFileSync("npm", ["test"], {
        cwd: dossier, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, COMPTAGE: "1" },
      });
    } catch (e: any) {
      /*
       * Une suite en échec ne doit pas être comptée comme si elle passait — mais il faut dire
       * *ce qui* a échoué.
       *
       * `npm test` enchaîne le typage, le contrôle du README et la suite. Quand il tombe avant
       * la suite, la sortie ne contient aucune ligne `ℹ fail`, et cette fonction annonçait
       * alors « 1 test en échec ». Faux, et coûteux : on cherche un test cassé pendant que le
       * vrai défaut est un README périmé ou une démo publiée qui a divergé de son build.
       *
       * C'est arrivé le 19 août 2026 — la feuille de style partagée avait été recopiée dans
       * les dépôts et pas dans la vitrine, et le message a envoyé chercher au mauvais endroit.
       */
      const brut = String(e.stdout ?? "") + String(e.stderr ?? "");
      sortie = brut;
      const ligneFail = /^ℹ fail (\d+)$/m.exec(brut);
      if (ligneFail) {
        throw new Error(`${depot} : ${ligneFail[1]} test(s) en échec — compter ce dépôt n'aurait pas de sens`);
      }
      const cause = brut.split("\n")
        .filter((l) => l.trim() && !/^(npm |>|$)/.test(l.trim()))
        .slice(-3).join("\n      ");
      throw new Error(
        `${depot} : \`npm test\` a échoué avant d'exécuter la suite — ce n'est pas un test cassé.\n`
        + `      ${cause}`);
    }
    /*
     * `pass` PLUS `skipped`, et non `pass` seul.
     *
     * Le comptage tourne avec `COMPTAGE=1`, drapeau qui met en pause le contrôle de
     * fraîcheur du chiffre — sans lui, ce contrôle refuserait de passer pendant qu'on
     * recompte, et le comptage ne pourrait jamais aboutir. L'instrument perdait donc
     * exactement le test qu'il neutralise pour pouvoir mesurer : `npm test` annonce 76
     * dans la vitrine, le comptage en retenait 75, et le nombre publié sur la page
     * d'accueil était faux d'autant. Mesuré le 22 août 2026.
     *
     * Un test en pause reste un test écrit et exécutable — il est compté. Une suite en
     * échec, elle, ne parvient jamais ici : le `catch` ci-dessus lève d'abord.
     */
    const lu = (mot: string) => Number(new RegExp(`^ℹ ${mot} (\\d+)$`, "m").exec(sortie)?.[1] ?? 0);
    parDepot[depot] = lu("pass") + lu("skipped");
  }
  return {
    nombre: Object.values(parDepot).reduce((a, b) => a + b, 0),
    parDepot, absents, nonCertifies,
  };
}

if (isMain(import.meta)) {
  const { nombre, parDepot, absents, nonCertifies } = compter();
  const chiffres = JSON.parse(readFileSync(CHIFFRES, "utf8"));
  chiffres.portfolio = {
    tests: nombre,
    parDepot,
    mesureLe: new Date().toISOString(),
    /* Le dernier commit de test connu au moment de la mesure, dépôt par dépôt :
     * c'est lui qui permet de dire « ce compte a vieilli » sans relancer les suites. */
    testsCommitesLe: Object.fromEntries(DEPOTS.map((d) => [d, dernierTest(d)])),
    /*
     * Les dépôts que ce comptage n'a PAS certifiés, et pourquoi.
     *
     * Un chiffre issu d'une sélection porte le compte de ce qu'il écarte, ou ce n'est pas
     * un chiffre — c'est un échantillon présenté comme un recensement. Sans cette ligne,
     * un total plus petit se lirait comme « moins de tests » au lieu de « moins de dépôts
     * mesurés », et personne ne pourrait faire la différence.
     */
    nonCertifies,
  };
  writeFileSync(CHIFFRES, JSON.stringify(chiffres, null, 2) + "\n");
  const nc = Object.entries(nonCertifies);
  console.log(`${nombre} tests${absents.length ? `, ${absents.length} dépôt(s) absent(s)` : ""} — ${
    Object.entries(parDepot).map(([d, n]) => `${d} ${n}`).join(", ")}`);
  if (nc.length > 0) {
    console.log(`\n  ${nc.length} dépôt(s) NON CERTIFIÉ(S) — arbre modifié, le chiffre viendrait`);
    console.log("  d'un code qu'aucun commit ne contient :");
    for (const [d, n] of nc) console.log(`    ${d} — ${n} fichier(s) non commité(s)`);
    console.log("  Recomptez-les une fois leur arbre propre. Le total ci-dessus les exclut.");
  }
}

/*
 * LA MESURE QU'UN AUTRE POSTE NE PEUT PAS REFAIRE.
 *
 * La recherche documentaire annonce, sur sa page publique, avoir été passée sur cinq PDF
 * réels — 312 pages, 618 passages, treize secondes d'indexation, aucun fichier illisible.
 * Ces documents ne quittent pas la machine : `corpus-reel/` est ignoré par git, et c'est
 * une décision, pas un oubli. Le registre public ne peut donc pas les recalculer.
 *
 * Même traitement que la stabilité du banc : on mesure une fois, ici, on écrit le résultat
 * avec sa date, et `mesurer.ts` le recopie sans jamais tenter de le refaire. Un poste sans
 * le corpus garde la valeur enregistrée au lieu de l'effacer.
 *
 * Ce qui reste hors de portée, et doit le rester : les taux de retrouvaille sur ce corpus
 * (31 %, 75 %, 88 %…). Ils ont été mesurés sur un jeu de vingt questions qui n'a pas été
 * conservé. La mesure est vraie, elle n'est plus reproductible, et la page le dit désormais
 * plutôt que de laisser croire le contraire.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { isMain } from "./cli.ts";

const VOISINS = new URL("../../", import.meta.url).pathname;
const CORPUS = `${VOISINS}rag/corpus-reel`;
const CHIFFRES = new URL("../chiffres.json", import.meta.url).pathname;

/** Le nombre de pages vient des PDF eux-mêmes, pas des numéros imprimés dessus : ces
 *  documents sont des extraits, et leurs pages internes vont jusqu'à 370. */
function pages(): number {
  return readdirSync(CORPUS).filter((f) => f.endsWith(".pdf")).reduce((n, f) => {
    const s = execFileSync("mdls", ["-raw", "-name", "kMDItemNumberOfPages", `${CORPUS}/${f}`], { encoding: "utf8" });
    return n + (Number(s) || 0);
  }, 0);
}

/*
 * Le temps d'indexation ne veut dire quelque chose qu'à froid.
 *
 * Premier essai : zéro seconde, parce que le cache de vecteurs était encore chaud d'une
 * mesure précédente. « 618 passages indexés en treize secondes » est une promesse faite à
 * quelqu'un qui lance l'outil pour la première fois ; la mesurer sur un index déjà calculé
 * répond à une autre question.
 */
const CACHE = `${VOISINS}rag/data/vecteurs.json`;

export async function figerReel() {
  if (existsSync(CACHE)) rmSync(CACHE);
  const M = await import(`${VOISINS}rag/src/index.ts`);
  const t0 = Date.now();
  const e1 = await M.etape1_lire(CORPUS);
  const t1 = Date.now();
  const e2 = await M.etape2_indexer();
  return {
    documents: e1.documents.length,
    pages: pages(),
    passages: e2.morceaux,
    illisibles: (e1.ignores ?? []).length,
    secondesIndexation: Math.round((Date.now() - t1) / 1000),
    secondesLecture: Math.round((t1 - t0) / 1000),
    mesureLe: new Date().toISOString(),
  };
}

if (isMain(import.meta)) {
  if (!existsSync(CORPUS)) {
    console.error("corpus-reel absent de cette machine — rien à mesurer, la valeur enregistrée est conservée");
    process.exit(1);
  }
  const chiffres = JSON.parse(readFileSync(CHIFFRES, "utf8"));
  chiffres.ragReel = await figerReel();
  writeFileSync(CHIFFRES, JSON.stringify(chiffres, null, 2) + "\n");
  console.log(`corpus réel figé : ${chiffres.ragReel.documents} PDF, ${chiffres.ragReel.pages} pages, ` +
    `${chiffres.ragReel.passages} passages, ${chiffres.ragReel.secondesIndexation} s d'indexation`);
}

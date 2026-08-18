/*
 * LA PROVENANCE DANS LA PROSE.
 *
 * Les blocs `<!-- figures:… -->` sont écrits par les modèles et tenus par `readme.ts
 * --check`. Autour d'eux, la prose affirme des chiffres que personne ne vérifie — et c'est
 * là qu'ils ont menti, chaque fois : 147 tests pour 169, 27 pour 47, un montant pris dans
 * le mauvais tableau, une capture annonçant 868 000 $ à côté d'un tableau qui disait
 * 496 000 $.
 *
 * Le portfolio a déjà un vocabulaire de provenance — retrouvé, mesuré, supposé, choisi —
 * appliqué aux figures et aux tableaux. Ce module l'étend à la phrase : une affirmation
 * chiffrée nomme la quantité dont elle sort, et le nom pointe dans `chiffres.json`, qui
 * est lui-même recalculé par `mesurer --check`. La chaîne est fermée du modèle à la phrase.
 *
 * La marque est un commentaire HTML, donc **invisible sur GitHub** :
 *
 *     un jeu de <!--p:banc.cas-->22<!--/p--> cas
 *     <!--p:cycle.partAttente~pc-->95.4 %<!--/p--> d'attente
 *     <!--p:economics.coutAnnuel~usd-->$496,000<!--/p--> par an
 *
 * Ce que ce module ne fait pas : deviner. Il ne va pas chercher les nombres non marqués —
 * un README contient des numéros d'étape, un port, une version de Node, des articles de
 * règlement. Exiger que chaque chiffre soit rendu par un modèle transformerait la prose en
 * formulaire. Ce qu'il garantit est plus étroit et suffit : **ce qui est marqué ne peut
 * plus se périmer en silence**, et marquer coûte une ligne.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { isMain } from "./cli.ts";

const VOISINS = new URL("../../", import.meta.url).pathname;
const CHIFFRES = new URL("../chiffres.json", import.meta.url).pathname;

/** Les README qui portent des marques, et où ils vivent. */
/*
 * Les pages marquées. Un README par outil, plus la page d'accueil du profil et la note
 * écrite qui l'accompagne — celle-là n'est pas un README, d'où le chemin complet : la
 * provenance ne dépend pas du nom du fichier.
 */
export const PAGES = [
  "economics/README.md", "triage/README.md", "funnel/README.md", "cycle/README.md",
  "banc/README.md", "rag/README.md", "rag-vitrine/README.md",
  "profil/README.md", "profil/benchmarks-are-not-yours.md",
];

/*
 * Le séparateur de format est un tilde, et ce n'est pas un caprice.
 *
 * La première version écrivait `<!--p:cle|format-->`. Dans une phrase, parfait. Dans une
 * **cellule de tableau markdown**, la barre verticale est le séparateur de colonnes : GitHub
 * coupait la marque en deux et affichait « pc0--&gt;58 % of files decided… » en pleine page
 * d'accueil. Invisible en local, visible pour tout le monde — exactement la classe de défaut
 * que ce module existe pour fermer, commise par le module lui-même.
 */
const MARQUE = /<!--p:([a-zA-Z0-9_.]+)(?:~([a-zA-Z0-9]+))?-->([\s\S]*?)<!--\/p-->/g;

/**
 * Comment une quantité s'écrit dans une phrase.
 *
 * Le format est explicite plutôt que deviné : « 0,583 » se dit « 58 % » ou « 58,3 % » selon
 * la phrase, et une machine qui choisit à la place de l'auteur écrit des textes que
 * personne ne relit.
 */
export const FORMATS: Record<string, (v: any) => string> = {
  brut: (v) => String(v),
  n1: (v) => Number(v).toFixed(1),
  n2: (v) => Number(v).toFixed(2),
  milliers: (v) => Number(v).toLocaleString("en-GB"),
  usd: (v) => "$" + Number(v).toLocaleString("en-GB"),
  pc: (v) => (Number(v) * 100).toFixed(1) + " %",
  pc0: (v) => Math.round(Number(v) * 100) + " %",
  x1: (v) => Number(v).toFixed(1) + "×",
};

export function valeur(chiffres: any, cle: string): unknown {
  return cle.split(".").reduce((o: any, k) => (o == null ? undefined : o[k]), chiffres);
}

export type Ecart = { page: string; cle: string; ecrit: string; attendu: string };

export function relire(mode: "check" | "write"): { marques: number; ecarts: Ecart[]; inconnues: string[] } {
  const chiffres = JSON.parse(readFileSync(CHIFFRES, "utf8"));
  const ecarts: Ecart[] = [];
  const inconnues: string[] = [];
  let marques = 0;

  for (const page of PAGES) {
    const chemin = `${VOISINS}${page}`;
    if (!existsSync(chemin)) continue;
    const avant = readFileSync(chemin, "utf8");

    /*
     * Une marque dans un bloc généré disparaît au premier `npm run figures`.
     *
     * C'est arrivé au premier essai : deux phrases marquées à l'intérieur d'un bloc
     * `<!-- figures:… -->`, effacées par le générateur, sans un mot. Ces lignes-là sont déjà
     * tenues — le marquage y est inutile, et surtout il donne l'illusion d'une garantie
     * qu'on vient de perdre.
     */
    for (const bloc of avant.matchAll(/<!-- figures:[\s\S]*?<!-- \/figures:[a-zA-Z0-9_-]* -->/g)) {
      if (bloc[0].includes("<!--p:")) inconnues.push(`${page} : une marque est dans un bloc généré, elle sera effacée`);
    }

    /*
     * Une marque mal formée s'affiche au lieu de disparaître.
     *
     * Compter les ouvertures et les marques reconnues : si l'un dépasse l'autre, un fragment
     * finira dans le texte que le lecteur voit. C'est ce qui est arrivé avec la barre
     * verticale du format dans une cellule de tableau.
     */
    const ouvertures = (avant.match(/<!--p:/g) ?? []).length;
    const reconnues = (avant.match(MARQUE) ?? []).length;
    if (ouvertures !== reconnues) {
      inconnues.push(`${page} : ${ouvertures} marque(s) ouverte(s) pour ${reconnues} reconnue(s) — un fragment s'affichera`);
    }

    const apres = avant.replace(MARQUE, (tout, cle, format, ecrit) => {
      marques++;
      const v = valeur(chiffres, cle);
      if (v === undefined) { inconnues.push(`${page} : ${cle}`); return tout; }
      const rendre = FORMATS[format ?? "brut"];
      if (!rendre) { inconnues.push(`${page} : format « ${format} » inconnu`); return tout; }
      const attendu = rendre(v);
      if (attendu === ecrit) return tout;
      ecarts.push({ page, cle, ecrit, attendu });
      return `<!--p:${cle}${format ? "~" + format : ""}-->${attendu}<!--/p-->`;
    });
    if (mode === "write" && apres !== avant) writeFileSync(chemin, apres);
  }
  return { marques, ecarts, inconnues };
}

if (isMain(import.meta)) {
  const controle = process.argv.includes("--check");
  const { marques, ecarts, inconnues } = relire(controle ? "check" : "write");

  if (inconnues.length) {
    console.error("des marques ne pointent sur rien :");
    for (const i of inconnues) console.error(`  ${i}`);
    process.exit(1);
  }
  if (ecarts.length) {
    if (controle) {
      console.error("des affirmations ne disent plus ce que la mesure dit — lancer `npm run prose` :");
      for (const e of ecarts) console.error(`  ${e.page} · ${e.cle} : écrit « ${e.ecrit} », mesuré « ${e.attendu} »`);
      process.exit(1);
    }
    console.log(`${ecarts.length} affirmation(s) remises à jour :`);
    for (const e of ecarts) console.log(`  ${e.page} · ${e.cle} : ${e.ecrit} → ${e.attendu}`);
  } else {
    console.log(`${marques} affirmation(s) marquée(s), toutes d'accord avec la mesure`);
  }
}

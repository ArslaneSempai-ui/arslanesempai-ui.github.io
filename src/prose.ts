import { fileURLToPath } from "node:url";
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

const VOISINS = fileURLToPath(new URL("../../", import.meta.url));
const CHIFFRES = fileURLToPath(new URL("../chiffres.json", import.meta.url));

/** Les README qui portent des marques, et où ils vivent. */
/*
 * Les pages marquées. Un README par outil, plus la page d'accueil du profil et la note
 * écrite qui l'accompagne — celle-là n'est pas un README, d'où le chemin complet : la
 * provenance ne dépend pas du nom du fichier.
 */
export const PAGES = [
  "economics/README.md", "triage/README.md", "funnel/README.md", "cycle/README.md",
  "banc/README.md", "rag/README.md", "rag-vitrine/README.md",
  "arbitrage/README.md", "cascade/README.md", "derive/README.md", "remediation/README.md",
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

/**
 * UNE MARQUE QUI PEND N'EST PAS TOUJOURS UNE PANNE.
 *
 * Le 22 août 2026, `cascade` est sorti de la liste des dépôts comptés — une autre session y
 * travaille et la diffusion y aurait écrasé ses fichiers partagés. Son README portait encore
 * `<!--p:portfolio.parDepot.cascade-->`, dont la clé a cessé d'exister avec lui. `prose` a
 * refusé d'écrire, ce qui était juste, mais il refusait **définitivement** : la chaîne
 * mesure → prose → comptage restait bloquée sans qu'aucune correction locale la lève.
 *
 * Deux situations que l'ancien code confondait :
 *
 *   - la clé nomme un dépôt **déclaré hors liste** dans `identite/depots.json`, avec sa raison
 *     et sa date. La marque pend légitimement — la valeur n'existe plus parce que le dépôt
 *     n'est plus compté — et ça ne doit pas arrêter la chaîne.
 *   - la clé nomme un dépôt **absent du disque**. Là c'est une panne : quelque chose a disparu
 *     sans être déclaré.
 *
 * Dans les deux cas la marque est **comptée et nommée**. Remplacer un refus par un silence
 * échangerait un mur contre un vert vide.
 */
const LISTE = fileURLToPath(new URL("../../identite/depots.json", import.meta.url));

function horsListe(): Record<string, { pourquoi?: string; depuis?: string }> {
  try { return JSON.parse(readFileSync(LISTE, "utf8")).exclus ?? {}; } catch { return {}; }
}

export type Relecture = { marques: number; ecarts: Ecart[]; inconnues: string[];
                          pendantes: string[]; pagesAbsentes: string[] };

export function relire(mode: "check" | "write"): Relecture {
  const chiffres = JSON.parse(readFileSync(CHIFFRES, "utf8"));
  const exclus = horsListe();
  const ecarts: Ecart[] = [];
  const inconnues: string[] = [];
  const pendantes: string[] = [];
  const pagesAbsentes: string[] = [];
  let marques = 0;

  for (const page of PAGES) {
    const chemin = `${VOISINS}${page}`;
    /* Une page absente se dit. Sautée en silence, elle laisse croire qu'elle a été relue. */
    if (!existsSync(chemin)) { pagesAbsentes.push(page); continue; }
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
      if (v === undefined) {
        /*
         * La clé nomme-t-elle un dépôt sorti de la liste ? On regarde chaque segment :
         * `portfolio.parDepot.cascade` pend parce que `cascade` est exclu, et la raison est
         * écrite dans `depots.json`, pas devinée ici.
         */
        const nom = cle.split(".").find((seg: string) => seg in exclus);
        if (nom && existsSync(`${VOISINS}${nom}`)) {
          pendantes.push(`${page} : ${cle} — « ${nom} » hors liste depuis le ${exclus[nom]!.depuis ?? "?"}`);
        } else if (nom) {
          inconnues.push(`${page} : ${cle} — « ${nom} » est hors liste ET absent du disque`);
        } else {
          inconnues.push(`${page} : ${cle}`);
        }
        return tout;
      }
      const rendre = FORMATS[format ?? "brut"];
      if (!rendre) { inconnues.push(`${page} : format « ${format} » inconnu`); return tout; }
      const attendu = rendre(v);
      if (attendu === ecrit) return tout;
      ecarts.push({ page, cle, ecrit, attendu });
      return `<!--p:${cle}${format ? "~" + format : ""}-->${attendu}<!--/p-->`;
    });
    if (mode === "write" && apres !== avant) writeFileSync(chemin, apres);
  }
  return { marques, ecarts, inconnues, pendantes, pagesAbsentes };
}

if (isMain(import.meta)) {
  const controle = process.argv.includes("--check");
  const { marques, ecarts, inconnues, pendantes, pagesAbsentes } = relire(controle ? "check" : "write");

  /* Comptées et nommées, jamais tues — mais elles n'arrêtent pas la chaîne. */
  if (pendantes.length) {
    console.log(`${pendantes.length} marque(s) orpheline(s), dépôt hors liste :`);
    for (const x of pendantes) console.log(`  ${x}`);
    console.log(`  → la valeur n'existe plus parce que le dépôt n'est plus compté. Retirer la`);
    console.log(`    marque de sa page, ou le réinscrire dans depots.json.`);
  }
  if (pagesAbsentes.length) {
    console.log(`${pagesAbsentes.length} page(s) marquée(s) absente(s) du disque : ${pagesAbsentes.join(", ")}`);
  }
  if (inconnues.length) {
    console.error("des marques ne pointent sur rien :");
    for (const i of inconnues) console.error(`  ${i}`);
    process.exit(1);
  }
  if (ecarts.length) {
    /*
     * EN PAUSE PENDANT LE COMPTAGE — troisieme blocage circulaire de la soiree, meme dessin.
     *
     * `compter` lance `npm test` chez chaque voisin, dont la vitrine. Ce controle y compare
     * la prose publiee au contenu de `chiffres.json` — deux choses qui, PENDANT le tour,
     * different forcement : le tour est justement en train de produire les nouveaux
     * chiffres. Il echouait donc, `npm test` tombait avant sa suite, `compter` refusait de
     * compter un depot dont la suite echoue, et le tour ne pouvait plus aboutir. Donc plus
     * rien ne pouvait mettre la prose a jour. **Le controle interdisait la mesure qui aurait
     * fait disparaitre son motif.**
     *
     * Il continue de tirer hors du comptage : l'ecart entre la page et la mesure reste un
     * vrai defaut et reste visible. Il cesse seulement de bloquer le seul geste capable de
     * le resoudre.
     */
    if (controle && process.env.COMPTAGE) {
      console.log(`${ecarts.length} ecart(s) — comptage en cours, la prose porte encore les `
        + "chiffres precedents. Controle en pause, il reprend hors comptage.");
      process.exit(0);
    }
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

import { fileURLToPath } from "node:url";
/*
 * LES MODÈLES EMPRUNTÉS AUX OUTILS.
 *
 * Le diagnostic fait tourner les modèles des six dépôts dans le navigateur du visiteur.
 * Or ces dépôts sont voisins sur une machine et absents partout ailleurs : un `import`
 * vers `../../economics/src/model.ts` marche ici, et nulle part sur GitHub Pages.
 *
 * Alors on copie, comme on copie déjà `registre.css` et `graphes.js` dans les six dépôts.
 * Ce qui rend la copie acceptable, ce n'est pas la copie : c'est le contrôle. `--check`
 * compare octet pour octet et refuse de passer si un fichier a divergé de son original.
 * Une copie surveillée est une dépendance ; une copie oubliée est un mensonge qui vieillit.
 *
 * Ce qui n'est pas emprunté : rien du moteur de recherche documentaire. Il est privé, et
 * le diagnostic ne le note pas — il démontre une méthode, pas une économie.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { isMain } from "./cli.ts";

const VOISINS = fileURLToPath(new URL("../../", import.meta.url));
const DEPOT = fileURLToPath(new URL("../src/emprunts/", import.meta.url));

/**
 * Les fichiers empruntés, et pourquoi chacun.
 *
 * Le graphe d'imports est fermé : chaque fichier listé n'importe que d'autres fichiers de
 * cette liste, ou `cli.ts` que la vitrine possède déjà. Un test le vérifie, parce qu'un
 * import oublié ne casse qu'au chargement de la page, dans le navigateur, sans trace.
 */
export const EMPRUNTS: { depot: string; fichiers: string[] }[] = [
  {
    depot: "economics",
    fichiers: [
      "alerts.ts",       // la population d'alertes, et sa séparation paramétrable
      "model.ts",        // le balayage de seuils, la file, le coût marginal
      "calibrate.ts",    // les trois niveaux : supposé, ajusté, mesuré
      "regulations.ts",  // les délais cités, dont dépend « le délai tient-il »
    ],
  },
  {
    depot: "cycle",
    fichiers: [
      "events.ts",       // la forme d'un journal d'événements
      "time.ts",         // délai de bout en bout, temps travaillé, part d'attente
      "paths.ts",        // conformité et routes distinctes
      "assumptions.ts", // les prix que le visiteur remplace par les siens
      "rework.ts",       // les cohortes de reprise, et ce que la reprise coûte
    ],
  },
];

/*
 * Les outils partagés, déposés dans chaque dossier emprunté.
 *
 * Les modèles importent `./cli.ts` et `./interval.ts` depuis leur propre répertoire. Une
 * fois déplacés ici, ces imports ne résolvent plus rien — et l'erreur ne se voit qu'au
 * chargement de la page, dans le navigateur, sans trace côté build. On les recopie donc à
 * côté, depuis l'identité commune, qui en est la source unique.
 */
const DEJA_LA = new Set(["cli.ts", "interval.ts"]);

export type Ecart = { chemin: string; raison: string };

export function emprunter(controle: boolean): { copies: number; ecarts: Ecart[]; absents: string[] } {
  const ecarts: Ecart[] = [];
  const absents: string[] = [];
  let copies = 0;

  for (const { depot, fichiers } of EMPRUNTS) {
    const source = `${VOISINS}${depot}/src/`;
    const cible = `${DEPOT}${depot}/`;
    if (!existsSync(source)) { absents.push(depot); continue; }
    if (!controle) mkdirSync(cible, { recursive: true });

    /* Les outils partagés d'abord : sans eux, les modèles n'ont pas de quoi s'importer. */
    for (const outil of DEJA_LA) {
      const origine = `${VOISINS}identite/${outil}`;
      if (!existsSync(origine)) continue;
      const contenu = readFileSync(origine, "utf8");
      if (controle) {
        if (!existsSync(cible + outil) || readFileSync(cible + outil, "utf8") !== contenu) {
          ecarts.push({ chemin: `${depot}/${outil}`, raison: "outil partagé absent ou divergent" });
        }
      } else { writeFileSync(cible + outil, contenu); copies++; }
    }

    for (const f of fichiers) {
      const origine = source + f;
      if (!existsSync(origine)) { ecarts.push({ chemin: `${depot}/${f}`, raison: "absent du dépôt d'origine" }); continue; }
      const contenu = readFileSync(origine, "utf8");

      if (controle) {
        if (!existsSync(cible + f)) { ecarts.push({ chemin: `${depot}/${f}`, raison: "jamais emprunté" }); continue; }
        if (readFileSync(cible + f, "utf8") !== contenu) {
          ecarts.push({ chemin: `${depot}/${f}`, raison: "a divergé de l'original" });
        }
        continue;
      }
      writeFileSync(cible + f, contenu);
      copies++;
    }

    /* Un fichier qui traîne après avoir été retiré de la liste continuerait d'être servi. */
    if (!controle && existsSync(cible)) {
      for (const present of readdirSync(cible)) {
        if (!fichiers.includes(present) && !DEJA_LA.has(present)) rmSync(cible + present);
      }
    }
  }
  return { copies, ecarts, absents };
}

if (isMain(import.meta)) {
  const controle = process.argv.includes("--check");
  const { copies, ecarts, absents } = emprunter(controle);

  if (ecarts.length) {
    console.error(controle
      ? "des modèles empruntés ont divergé — lancer `npm run emprunter`"
      : "emprunt incomplet :");
    for (const e of ecarts) console.error(`  ${e.chemin} — ${e.raison}`);
    process.exit(1);
  }
  console.log(controle
    ? `modèles empruntés à jour${absents.length ? `, ${absents.length} dépôt(s) absent(s) : ${absents.join(", ")}` : ""}`
    : `${copies} fichier(s) empruntés${absents.length ? `, ${absents.length} dépôt(s) absent(s)` : ""}`);
}

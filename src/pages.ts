/*
 * LA PAGE D'ENTRÉE.
 *
 * Six outils, six dépôts, six démos — et jusqu'ici aucune page qui les tienne ensemble.
 * Quelqu'un qui arrive par un lien tombe sur l'un d'eux au hasard, sans savoir qu'il y en a
 * cinq autres ni ce que l'ensemble démontre. Celle-ci répond en un écran : une trouvaille
 * par outil, la figure qui la porte, et les deux liens qui permettent de vérifier.
 *
 * ─── Trois contraintes tenues ───
 *
 *  1. **Aucun chiffre n'est écrit à la main.** Tout vient de `chiffres.json`, produit en
 *     faisant tourner les six modèles. Un test refuse de passer si le fichier a vieilli.
 *  2. **La page se lit sans JavaScript.** L'anglais est rendu dans le HTML ; le français
 *     est là aussi, et le sélecteur ne fait que basculer une classe. Une page d'entrée qui
 *     dépend d'un script pour afficher son texte est une page qui apparaît vide le jour où
 *     le script ne charge pas.
 *  3. **Le moteur de recherche documentaire reste privé.** Le lien « source » de cet
 *     outil-là pointe vers le dépôt public — l'article et la démo — jamais vers le moteur.
 *     C'est une décision, pas un oubli, et elle est écrite ici pour qu'on ne la « corrige »
 *     pas plus tard.
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { isMain } from "./cli.ts";
import { lire } from "./mesurer.ts";
import { barres, empile } from "./graphes.js";

const racine = new URL("..", import.meta.url).pathname;

const ech = (t: unknown) => String(t ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Un fragment bilingue de *texte riche*, pour la prose de la tuile. */
const bi = (en: string, fr: string) =>
  `<span class="en">${en}</span><span class="fr">${fr}</span>`;

/**
 * Le mot juste selon la langue, pour ce qui entre dans une figure.
 *
 * `graphes.js` échappe tout ce qu'on lui donne — c'est sa règle, et elle est bonne : un
 * libellé venu d'ailleurs ne doit jamais pouvoir injecter du HTML. Conséquence : on ne peut
 * pas y glisser deux langues dans un `<span>`. Chaque figure est donc rendue deux fois, et
 * le sélecteur montre la bonne.
 */
export type Langue = "en" | "fr";
const mot = (l: Langue) => (en: string, fr: string) => (l === "fr" ? fr : en);

const nb = (n: number) => Math.round(n).toLocaleString("en-GB");
const pc = (x: number) => `${Math.round(x * 100)} %`;
const dollars = (n: number) => "$" + Math.round(n).toLocaleString("en-GB");

type Outil = {
  cle: string;
  nom: string;
  depot: string;
  demo: string;
  source: string;
  /** La trouvaille, en une phrase. Les nombres viennent de `chiffres.json`. */
  trouvaille: (c: Record<string, any>) => [string, string];
  /** La lecture de droite : le nombre (HTML, `<em>` pour le suffixe) et son unité. */
  lecture: (c: Record<string, any>) => [string, string, string];
  pied: (c: Record<string, any>) => [string, string];
};

const BASE_DEMO = "https://arslanesempai-ui.github.io";
const BASE_SRC = "https://github.com/ArslaneSempai-ui";

const OUTILS: Outil[] = [
  {
    cle: "economics", nom: "The economics of a detection threshold",
    depot: "alert-triage-economics",
    demo: `${BASE_DEMO}/alert-triage-economics/`, source: `${BASE_SRC}/alert-triage-economics`,
    trouvaille: (c) => [
      `<b>${c.analystesEnPoste - c.analystesUtilises} of ${c.analystesEnPoste} analysts</b> are paid to handle nothing, and the next true positive is <b>free</b> down to threshold ${c.seuilGratuitLePlusLarge}.`,
      `<b>${c.analystesEnPoste - c.analystesUtilises} analystes sur ${c.analystesEnPoste}</b> sont payés à ne rien traiter, et le vrai positif suivant est <b>gratuit</b> jusqu'au seuil ${c.seuilGratuitLePlusLarge}.`,
    ],
    lecture: (c) => [`${c.analystesEnPoste - c.analystesUtilises}<em>/${c.analystesEnPoste}</em>`, "analystes inoccupés", "analysts idle"],
    pied: (c) => [
      `Next true positive · $0 → ${dollars(c.casSuivantLePlusCher)}`,
      `Le cas suivant · $0 → ${dollars(c.casSuivantLePlusCher)}`,
    ],
  },
  {
    cle: "triage", nom: "Onboarding triage",
    depot: "kyc-triage-agent",
    demo: `${BASE_DEMO}/kyc-triage-agent/`, source: `${BASE_SRC}/kyc-triage-agent`,
    trouvaille: (c) => [
      `<b>${pc(c.partAutomatisee)}</b> of files decided without a human, and <b>${c.manquements}</b> uncontrolled onboardings — the agent stops where it is not sure.`,
      `<b>${pc(c.partAutomatisee)}</b> des dossiers décidés sans humain, et <b>${c.manquements}</b> entrée en relation non contrôlée — l'agent s'arrête là où il n'est pas sûr.`,
    ],
    lecture: (c) => [`${c.manquements}`, "manquement sur " + nb(c.dossiers), "breach in " + nb(c.dossiers)],
    pied: (c) => [
      `Right when automatic · ${pc(c.justesse)}`,
      `Justesse en automatique · ${pc(c.justesse)}`,
    ],
  },
  {
    cle: "funnel", nom: "Where the funnel leaks, and what that is worth",
    depot: "funnel-economics",
    demo: `${BASE_DEMO}/funnel-economics/`, source: `${BASE_SRC}/funnel-economics`,
    trouvaille: (c) => [
      `The biggest leak is not the best place to spend: <b>${c.meilleurRendement}×</b> against <b>${c.pireRendement}×</b> per dollar — a factor of ${c.facteur}.`,
      `Le plus gros trou n'est pas le meilleur endroit où dépenser : <b>${c.meilleurRendement}×</b> contre <b>${c.pireRendement}×</b> par dollar — un facteur ${c.facteur}.`,
    ],
    lecture: (c) => [`${c.facteur}<em>×</em>`, "d'écart entre leviers", "between best and worst lever"],
    pied: (c) => [
      `Weakest step · ${c.etapeLaPlusFaible}`,
      `Étape la plus faible · ${c.etapeLaPlusFaible}`,
    ],
  },
  {
    cle: "arbitrage", nom: "Growth versus controls, priced instead of argued",
    depot: "growth-versus-controls",
    demo: `${BASE_DEMO}/growth-versus-controls/`, source: `${BASE_SRC}/growth-versus-controls`,
    trouvaille: (c) => [
      `The A/B test settles the lift — <b>${c.ecartConversion} %</b> [${c.ecartBas} – ${c.ecartHaut}] — and not the decision. The sign flips at an undetected-risk share of <b>${c.bascule} %</b>, inside the range both sides defend.`,
      `Le test A/B établit le gain — <b>${c.ecartConversion} %</b> [${c.ecartBas} – ${c.ecartHaut}] — et pas la décision. Le signe bascule à <b>${c.bascule} %</b> de risque non détecté, dans la fourchette que les deux camps défendent.`,
    ],
    lecture: (c) => [`${c.bascule}<em> %</em>`, "où le verdict bascule", "where the verdict flips"],
    pied: (c) => [
      `Sign decided by the ${c.signeDecidePar}, not the other one`,
      `Signe décidé par les hypothèses, pas par le test`,
    ],
  },
  {
    cle: "cycle", nom: "Eleven days, and nobody worked on it for nine",
    depot: "process-cycle-time",
    demo: `${BASE_DEMO}/process-cycle-time/`, source: `${BASE_SRC}/process-cycle-time`,
    trouvaille: (c) => [
      `${c.joursDeBoutEnBout} days end to end, of which <b>${c.heuresTravaillees} hours</b> of actual work. <b>${pc(c.partAttente)}</b> of the time nobody is touching the file.`,
      `${c.joursDeBoutEnBout} jours de bout en bout, dont <b>${c.heuresTravaillees} heures</b> de travail réel. <b>${pc(c.partAttente)}</b> du temps, personne n'y touche.`,
    ],
    lecture: (c) => [`${Math.round(c.partAttente * 100)}<em> %</em>`, "du délai en attente", "of the delay is waiting"],
    pied: (c) => [
      `${c.routesDistinctes} distinct routes · ${pc(c.conformite)} conform`,
      `${c.routesDistinctes} routes distinctes · ${pc(c.conformite)} conformes`,
    ],
  },
  {
    cle: "banc", nom: "Regression bench",
    depot: "regression-bench",
    demo: `${BASE_DEMO}/regression-bench/`, source: `${BASE_SRC}/regression-bench`,
    trouvaille: (c) => [
      `Across ${c.versionsPubliees} deterministic versions, <b>${c.passesAuDebut} → ${c.passesALaFin}</b> of ${c.cas} cases. A rising pass rate can still hide a case that just broke.`,
      `Sur ${c.versionsPubliees} versions déterministes, <b>${c.passesAuDebut} → ${c.passesALaFin}</b> cas sur ${c.cas}. Un taux qui monte peut cacher un cas qui vient de casser.`,
    ],
    /* La quatrième version n'a pas de score : elle court après une horloge, et publier un
     * chiffre pour elle reviendrait à publier un tirage. C'est écrit sur la tuile. */
    lecture: (c) => [`${c.passesAuDebut}<em>→</em>${c.passesALaFin}`, "cas sur " + c.cas, "cases out of " + c.cas],
    pied: (c) => [
      `${c.versionNonDeterministe} · non-deterministic by design, no score published`,
      `${c.versionNonDeterministe} · non déterministe par construction, aucun score publié`,
    ],
  },
  {
    cle: "rag", nom: "Document search",
    depot: "compliance-document-search",
    demo: `${BASE_DEMO}/compliance-document-search/`, source: `${BASE_SRC}/compliance-document-search`,
    trouvaille: (c) => [
      `On ${c.questions} questions: <b>${c.justes} right</b>, ${c.ratees} wrong, and <b>${c.silencesJustifies} times it said nothing</b> — every time no answer existed in the corpus.`,
      `Sur ${c.questions} questions : <b>${c.justes} justes</b>, ${c.ratees} ratées, et <b>${c.silencesJustifies} fois il s'est tu</b> — chaque fois qu'aucune réponse n'existait dans le corpus.`,
    ],
    lecture: (c) => [`${c.silencesJustifies}`, "silences justifiés", "justified silences"],
    pied: () => [
      "Engine kept private · demo and write-up public",
      "Moteur gardé privé · démo et article publics",
    ],
  },
];

export function construire(): void {
  const c = lire();
  const docs = racine + "docs";
  mkdirSync(docs, { recursive: true });

  const tuiles = OUTILS.map((o, i) => {
    const n = c[o.cle];
    if (!n) throw new Error(`chiffres.json n'a rien pour « ${o.cle} » — lancer \`npm run mesurer\``);
    const [en, fr] = o.trouvaille(n);
    const [lecture, uniteFr, uniteEn] = o.lecture(n);
    /*
     * La ligne n'est pas un lien, elle en contient deux.
     *
     * Un `<a>` dans un `<a>` est invalide, et c'est ce qui a fait disparaître le lien vers
     * le code quand les tuiles sont devenues des lignes de relevé — un test l'a rattrapé.
     * Or c'est par ce lien qu'on vérifie : le supprimer transformait une démonstration en
     * affirmation.
     */
    return `<div class="outil">
      <span class="marque">${String(i + 1).padStart(2, "0")}</span>
      <span><a class="nom" href="${o.demo}">${ech(o.nom)}</a>
        <p class="constate"><span class="en">${en}</span><span class="fr">${fr}</span></p>
        <a class="code" href="${o.source}">${bi("source", "le code")}</a></span>
      <span class="lecture"><span class="n">${lecture}</span><span class="u">${bi(ech(uniteEn), ech(uniteFr))}</span></span>
    </div>`;
  }).join("\n");

  /* Les parts mesurées une fois, déposées dans la page pour que le diagnostic les lise. */
  const mesures = JSON.stringify({
    triagePartAutomatisee: c.triage?.partAutomatisee,
    triageDossiers: c.triage?.dossiers,
  });
  const html = readFileSync(racine + "src/gabarit.html", "utf8")
    .replace("<!--TUILES-->", tuiles)
    .replace("</main>", `</main>
<script type="application/json" id="mesures">${mesures}</script>`);
  writeFileSync(docs + "/index.html", html);
  cpSync(racine + "src/registre.css", docs + "/registre.css");
  writeFileSync(docs + "/.nojekyll", "");
  console.log(`docs/index.html construit — ${OUTILS.length} outils`);
}

if (isMain(import.meta)) construire();

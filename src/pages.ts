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
 *  2. **La page se lit sans JavaScript.** Le texte est rendu dans le HTML. Une page d'entrée
 *     qui dépend d'un script pour afficher son texte est une page qui apparaît vide le jour
 *     où le script ne charge pas.
 *
 *     *Corrigé le 22 août 2026.* Ce point décrivait un mécanisme bilingue — « l'anglais est
 *     rendu dans le HTML ; le français est là aussi, et le sélecteur ne fait que basculer une
 *     classe ». Ce mécanisme n'existe plus : la page est en anglais seul, il n'y a pas une
 *     occurrence de `class="fr"` ni de `class="en"`, et `vitrine.test.ts` **interdit** qu'il
 *     en revienne. Le commentaire décrivait donc un état que le contrôle rend impossible.
 *     C'est la forme la plus discrète du document qui ment : personne ne le relit, et il
 *     survit à ce qu'il décrit.
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

/** Mise en forme des nombres de la prose des tuiles. */
const nb = (n: number) => Math.round(n).toLocaleString("en-GB");
const pc = (x: number) => `${Math.round(x * 100)} %`;
const dollars = (n: number) => "$" + Math.round(n).toLocaleString("en-GB");

type Outil = {
  cle: string;
  nom: string;
  /**
   * Le dossier local, qui n'est pas toujours la clé.
   *
   * `cle: "rag"` désigne la recherche documentaire **publique**, dont le dossier est
   * `rag-vitrine` — et il existe par ailleurs un dossier local `rag`, qui est le dépôt gardé
   * privé. Un contrôle qui déduirait le dossier de la clé lirait donc le README du privé en
   * croyant lire celui de la démo. La correspondance est écrite plutôt que devinée.
   */
  dossier: string;
  depot: string;
  demo: string;
  source: string;
  /** La trouvaille, en une phrase. Les nombres viennent de `chiffres.json`. */
  trouvaille: (c: Record<string, any>) => string;
  /** La lecture de droite : le nombre (HTML, `<em>` pour le suffixe) et son unité. */
  lecture: (c: Record<string, any>) => [string, string];
};

const BASE_DEMO = "https://arslanesempai-ui.github.io";
const BASE_SRC = "https://github.com/ArslaneSempai-ui";

/*
 * Exporté depuis le 22 août 2026 : deux contrôles portaient chacun leur copie de cette liste,
 * l'un à dix noms figés et l'autre à six, et le second en ignorait quatre. Une liste de ce qui
 * est publié ne peut pas vivre à trois endroits.
 */
export const OUTILS: Outil[] = [
  {
    cle: "economics", dossier: "economics", nom: "The economics of a detection threshold",
    depot: "alert-triage-economics",
    demo: `${BASE_DEMO}/alert-triage-economics/`, source: `${BASE_SRC}/alert-triage-economics`,
    trouvaille: (c) => `<b>${c.analystesEnPoste - c.analystesUtilises} of ${c.analystesEnPoste} analysts</b> are paid to handle nothing, and the next true positive is <b>free</b> down to threshold ${c.seuilGratuitLePlusLarge}.`,
    lecture: (c) => [`${c.analystesEnPoste - c.analystesUtilises}<em>/${c.analystesEnPoste}</em>`, "analysts idle"],
  },
  {
    cle: "triage", dossier: "triage", nom: "Onboarding triage",
    depot: "kyc-triage-agent",
    demo: `${BASE_DEMO}/kyc-triage-agent/`, source: `${BASE_SRC}/kyc-triage-agent`,
    trouvaille: (c) => `<b>${pc(c.partAutomatisee)}</b> of files decided without a human, and <b>${c.manquements}</b> uncontrolled onboardings — the agent stops where it is not sure.`,
    lecture: (c) => [`${c.manquements}`, "breach in " + nb(c.dossiers)],
  },
  {
    cle: "funnel", dossier: "funnel", nom: "Where the funnel leaks, and what that is worth",
    depot: "funnel-economics",
    demo: `${BASE_DEMO}/funnel-economics/`, source: `${BASE_SRC}/funnel-economics`,
    trouvaille: (c) => `The biggest leak is not the best place to spend: <b>${c.meilleurRendement}×</b> against <b>${c.pireRendement}×</b> per dollar — a factor of ${c.facteur}.`,
    lecture: (c) => [`${c.facteur}<em>×</em>`, "between best and worst lever"],
  },
  {
    cle: "arbitrage", dossier: "arbitrage", nom: "Growth versus controls, priced instead of argued",
    depot: "growth-versus-controls",
    demo: `${BASE_DEMO}/growth-versus-controls/`, source: `${BASE_SRC}/growth-versus-controls`,
    trouvaille: (c) => `The A/B test settles the lift — <b>${c.ecartConversion} %</b> [${c.ecartBas} – ${c.ecartHaut}] — and not the decision. The sign flips at an undetected-risk share of <b>${c.bascule} %</b>, inside the range both sides defend.`,
    lecture: (c) => [`${c.bascule}<em> %</em>`, "where the verdict flips"],
  },
  {
    cle: "cascade", dossier: "cascade", nom: "Where should the next dollar go?",
    depot: "cascade-routing",
    demo: `${BASE_DEMO}/cascade-routing/`, source: `${BASE_SRC}/cascade-routing`,
    trouvaille: (c) => `Sending every field to the large model reaches ${c.justesseGrandModele} % for ${dollars(c.coutGrandModele)}. Routing field by field reaches <b>${c.justesseOptimale} %</b> for <b>${dollars(c.coutOptimal)}</b> — better and ${c.facteur}× cheaper, because ${c.champsGratuits} of the ${c.champs} fields are carried by regexes.`,
    lecture: (c) => [`${c.facteur}<em>×</em>`, "cheaper, and more accurate"],
  },
  {
    cle: "remediation", dossier: "remediation", nom: "The order is the plan",
    depot: "remediation-backlog",
    demo: `${BASE_DEMO}/remediation-backlog/`, source: `${BASE_SRC}/remediation-backlog`,
    trouvaille: (c) => `Taking the worst finding first misses <b>${c.manquesReflexe} of ${c.constats}</b> deadlines and costs <b>${dollars(c.coutReflexe)}</b>. The identical work sorted by deadline misses none. Same team, same effort, only the order changes.`,
    lecture: (c) => [`${dollars(c.coutReflexe)}`, "the reflex costs"],
  },
  {
    cle: "derive", dossier: "derive", nom: "The drift threshold sits above the signal",
    depot: "drift-monitor",
    demo: `${BASE_DEMO}/drift-monitor/`, source: `${BASE_SRC}/drift-monitor`,
    trouvaille: (c) => `Every note says to alarm at <b>${c.seuilDeLaNote}</b>. A ${c.deplacement}σ shift moves the index to <b>${c.signal}</b> — the alarm is above the signal it exists to see. Below <b>${c.fenetreSeparante}</b> observations a check, no threshold separates noise from that shift at all.`,
    lecture: (c) => [`${c.signal}`, `signal, against a ${c.seuilDeLaNote} alarm`],
  },
  {
    cle: "cycle", dossier: "cycle", nom: "Eleven days, and nobody worked on it for nine",
    depot: "process-cycle-time",
    demo: `${BASE_DEMO}/process-cycle-time/`, source: `${BASE_SRC}/process-cycle-time`,
    trouvaille: (c) => `${c.joursDeBoutEnBout} days end to end, of which <b>${c.heuresTravaillees} hours</b> of actual work. <b>${pc(c.partAttente)}</b> of the time nobody is touching the file.`,
    lecture: (c) => [`${Math.round(c.partAttente * 100)}<em> %</em>`, "of the delay is waiting"],
  },
  {
    cle: "banc", dossier: "banc", nom: "Regression bench",
    depot: "regression-bench",
    demo: `${BASE_DEMO}/regression-bench/`, source: `${BASE_SRC}/regression-bench`,
    trouvaille: (c) => `Across ${c.versionsPubliees} deterministic versions, <b>${c.passesAuDebut} → ${c.passesALaFin}</b> of ${c.cas} cases. A rising pass rate can still hide a case that just broke.`,
    /* La quatrième version n'a pas de score : elle court après une horloge, et publier un
     * chiffre pour elle reviendrait à publier un tirage. C'est écrit sur la tuile. */
    lecture: (c) => [`${c.passesAuDebut}<em>→</em>${c.passesALaFin}`, "cases out of " + c.cas],
  },
  {
    cle: "rag", dossier: "rag-vitrine", nom: "Document search",
    depot: "compliance-document-search",
    demo: `${BASE_DEMO}/compliance-document-search/`, source: `${BASE_SRC}/compliance-document-search`,
    trouvaille: (c) => `On ${c.questions} questions: <b>${c.justes} right</b>, ${c.ratees} wrong, and <b>${c.silencesJustifies} times it said nothing</b> — every time no answer existed in the corpus.`,
    lecture: (c) => [`${c.silencesJustifies}`, "justified silences"],
  },
];

export function construire(): void {
  const c = lire();
  const docs = racine + "docs";
  mkdirSync(docs, { recursive: true });

  const tuiles = OUTILS.map((o, i) => {
    const n = c[o.cle];
    if (!n) throw new Error(`chiffres.json n'a rien pour « ${o.cle} » — lancer \`npm run mesurer\``);
    const trouvaille = o.trouvaille(n);
    const [lecture, unite] = o.lecture(n);
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
        <p class="constate">${trouvaille}</p>
        <a class="code" href="${o.source}">source</a></span>
      <span class="lecture"><span class="n">${lecture}</span><span class="u">${ech(unite)}</span></span>
    </div>`;
  }).join("\n");

  /* Les parts mesurées une fois, déposées dans la page pour que le diagnostic les lise. */
  const mesures = JSON.stringify({
    triagePartAutomatisee: c.triage?.partAutomatisee,
    triageDossiers: c.triage?.dossiers,
  });
  /* Le titre comptait « six » en toutes lettres : il en est resté à six le jour où un
   * septième outil est arrivé. Un nombre écrit à la main dans une page vieillit. */
  const MOTS_NOMBRE = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
                       "nine", "ten", "eleven", "twelve"];
  const html = readFileSync(racine + "src/gabarit.html", "utf8")
    .replaceAll("<!--NOMBRE-TITRE-->", (MOTS_NOMBRE[OUTILS.length] ?? String(OUTILS.length)).replace(/^./, (m) => m.toUpperCase()))
    .replace("<!--NOMBRE-OUTILS-->", "The " + (MOTS_NOMBRE[OUTILS.length] ?? String(OUTILS.length)))
    .replace("<!--TUILES-->", tuiles)
    .replace("</main>", `</main>
<script type="application/json" id="mesures">${mesures}</script>`);
  writeFileSync(docs + "/index.html", html);
  cpSync(racine + "src/registre.css", docs + "/registre.css");
  writeFileSync(docs + "/.nojekyll", "");
  console.log(`docs/index.html construit — ${OUTILS.length} outils`);
}

if (isMain(import.meta)) construire();

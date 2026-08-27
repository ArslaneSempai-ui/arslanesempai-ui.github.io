/*
 * LE DIAGNOSTIC.
 *
 * On saisit ses chiffres une fois, ça traverse les modèles, et il en sort des montants
 * récupérables classés par argent. C'est le livrable d'un travail d'opérations : pas
 * « voici six outils », mais « voici ce que votre maison laisse sur la table, et dans quel
 * ordre le ramasser ».
 *
 * ─── La règle qui gouverne ce fichier ───
 *
 * **Chaque constat porte l'étiquette de ce qui l'a produit.** Un montant calculé sur les
 * volumes du visiteur ne vaut pas un montant calculé sur une population inventée, et les
 * confondre serait exactement le chiffre non vérifiable que ces six outils existent pour
 * dénoncer. Trois étiquettes, jamais mélangées :
 *
 *   `vôtre`    — calculé entièrement sur ce qu'ils ont fourni.
 *   `ajusté`   — la forme du modèle, recalée sur un point qu'ils ont observé.
 *   `supposé`  — la forme et l'échelle du dépôt, mises à leur volume. Une démonstration.
 *
 * Un diagnostic qui afficherait « supposé » en petit et le montant en gros serait une
 * publicité. Ici l'étiquette voyage avec le montant, dans la même structure, et l'écran
 * n'a pas le droit d'afficher l'un sans l'autre — un test le vérifie.
 *
 * ─── Ce qui n'est pas noté ───
 *
 * Le banc de régression et la recherche documentaire démontrent une méthode, pas une
 * économie. On ne peut pas les paramétrer par les chiffres d'un client sans inventer, donc
 * ils ne produisent pas de montant. Ils sont liés, pas notés. Refuser de chiffrer ce qu'on
 * ne sait pas chiffrer est le seul geste qui rend crédibles les quatre autres montants.
 */
import { generatePopulation } from "./emprunts/economics/alerts.js";
import { sweep, ASSUMPTIONS as ECO, THRESHOLDS } from "./emprunts/economics/model.js";
import { fitToObservation, ASSUMED } from "./emprunts/economics/calibrate.js";
import { wilson } from "./interval.js";
import { generate as journalDemo } from "./emprunts/cycle/events.js";
import { perCase } from "./emprunts/cycle/time.js";
import { costOfRework } from "./emprunts/cycle/rework.js";
import { ASSUMPTIONS as CYCLE } from "./emprunts/cycle/assumptions.js";
const BASE = "https://arslanesempai-ui.github.io";
/**
 * La séparation à utiliser, et à quel titre.
 *
 * Trois chemins, et le plus fort l'emporte : des dossiers scorés valent mieux qu'un point
 * observé, qui vaut mieux que la forme du dépôt.
 */
export function separationPour(e) {
    if (e.dossiersScores && e.dossiersScores.length >= 30) {
        /*
         * Niveau 3. On ne « fitte » pas : on ajuste la forme aux deux histogrammes fournis par
         * moments. Trente lignes est le plancher — en dessous, une moyenne empirique est plus
         * bruitée que la forme du dépôt, et prétendre l'inverse serait ajuster du bruit.
         */
        const vrais = e.dossiersScores.filter((d) => d.truePositive).map((d) => d.score);
        const faux = e.dossiersScores.filter((d) => !d.truePositive).map((d) => d.score);
        const refus = [];
        const sep = { ...ASSUMED };
        const moyenne = (x) => x.reduce((s, v) => s + v, 0) / x.length;
        /* L'écart-type du générateur vaut `spread · √½` : on inverse pour rester dans ses unités. */
        const etendue = (x, m) => Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, x.length - 1)) / Math.SQRT1_2;
        if (vrais.length >= 10) {
            sep.truePositiveMean = moyenne(vrais);
            sep.truePositiveSpread = Math.max(0.02, etendue(vrais, sep.truePositiveMean));
        }
        else
            refus.push("moins de dix cas réels dans le fichier : la forme du signal reste celle du dépôt");
        if (faux.length >= 10) {
            sep.falsePositiveMean = moyenne(faux);
            sep.falsePositiveSpread = Math.max(0.02, etendue(faux, sep.falsePositiveMean));
        }
        else
            refus.push("moins de dix cas écartés dans le fichier : la forme du bruit reste celle du dépôt");
        return { separation: sep, niveau: 3, refus };
    }
    const complet = e.operations && e.alertesParAn && e.tauxReel !== undefined && e.seuilActuel;
    if (complet) {
        const fit = fitToObservation({
            operations: e.operations,
            threshold: e.seuilActuel,
            alerts: e.alertesParAn,
            precision: e.tauxReel,
            truePositiveShare: e.partDeclarable ?? 0.0012,
        });
        /* Ajusté seulement si l'observation a réellement déterminé quelque chose. */
        const niveau = fit.fitted.falsePositive || fit.fitted.truePositive ? 2 : 1;
        return { separation: fit.separation, niveau: niveau, refus: fit.refused };
    }
    return { separation: ASSUMED, niveau: 1, refus: [] };
}
const dollars = (n) => "$" + Math.round(n).toLocaleString("en-GB");
/** La capacité déjà payée que le seuil actuel n'emploie pas. */
function capaciteInutilisee(e, separation) {
    const operations = e.operations ?? 400_000;
    const enPoste = e.analystesEnPoste ?? ECO.analystsInPost;
    const cout = e.coutChargeAnalyste ?? ECO.loadedCostPerAnalyst;
    const seuil = e.seuilActuel ?? 0.65;
    const hypotheses = { ...ECO, analystsInPost: enPoste, loadedCostPerAnalyst: cout };
    const pop = generatePopulation(operations, e.partDeclarable ?? 0.0012, 20260817, separation);
    const points = sweep(pop, THRESHOLDS, hypotheses);
    const ici = points.reduce((a, b) => Math.abs(b.threshold - seuil) < Math.abs(a.threshold - seuil) ? b : a);
    const inoccupes = Math.max(0, enPoste - ici.fteWhole);
    if (inoccupes <= 0)
        return null;
    /*
     * Ce qu'on peut acheter sans dépenser : le seuil le plus large dont la file tient, dont
     * le délai est respecté, et qui n'ajoute pas un analyste. Tout ce qu'il attrape en plus
     * est gratuit — c'est exactement la trouvaille de l'outil, appliquée à leur maison.
     */
    const gratuit = points
        .filter((p) => p.queueHolds && p.deadlineMet && p.fteWhole <= enPoste)
        .reduce((a, b) => (b.threshold < a.threshold ? b : a), ici);
    const gagnes = Math.max(0, gratuit.truePositivesCaught - ici.truePositivesCaught);
    return {
        outil: "economics",
        cle: "capacite",
        montant: inoccupes * cout,
        nature: "déjà payé",
        unite: "a year, already spent",
        provenance: "supposé",
        phrase: gagnes > 0
            ? `${inoccupes} of ${enPoste} analysts are paid to handle nothing at threshold ${ici.threshold.toFixed(2)}. Lowering it to ${gratuit.threshold.toFixed(2)} would catch ${gagnes} more cases for no extra money.`
            : `${inoccupes} of ${enPoste} analysts are paid to handle nothing at threshold ${ici.threshold.toFixed(2)}.`,
        reserve: null,
        lien: `${BASE}/alert-triage-economics/`,
    };
}
/**
 * L'entonnoir, calculé sur leurs propres comptes.
 *
 * Rien n'est supposé ici : leurs volumes déterminent chaque taux, et l'intervalle de
 * Wilson dit lesquels se classent. Deux étapes dont les intervalles se recouvrent ne se
 * classent pas — et c'est ce refus qui vaut le détour, pas le classement.
 */
function entonnoir(e) {
    const etapes = e.entonnoir;
    if (!etapes || etapes.length < 2)
        return null;
    const revenu = e.revenuParClient ?? 1200;
    const taux = etapes.map((s) => {
        const [bas, haut] = wilson(s.convertis, s.entres);
        return { ...s, taux: s.entres > 0 ? s.convertis / s.entres : 0, bas, haut };
    });
    const pire = taux.reduce((a, b) => (b.taux < a.taux ? b : a));
    const recouvre = taux.some((s) => s !== pire && s.bas <= pire.haut);
    /*
     * Ce que vaut un point de conversion sur l'étape la plus faible : les clients gagnés en
     * bout de chaîne, multipliés par le revenu annuel par client. Les taux en aval sont
     * les leurs, donc le report l'est aussi.
     */
    const apres = taux.slice(taux.indexOf(pire) + 1).reduce((p, s) => p * s.taux, 1);
    const parPoint = pire.entres * 0.01 * apres * revenu;
    return {
        outil: "funnel",
        cle: "entonnoir",
        montant: parPoint,
        nature: "à gagner",
        unite: "per point of conversion gained",
        provenance: "vôtre",
        phrase: `Your weakest step is “${pire.etape}”, at ${(pire.taux * 100).toFixed(1)} %. One point of conversion gained there is worth ${dollars(parPoint)} a year downstream.`,
        reserve: recouvre
            ? "this step's confidence interval overlaps another's: on your volumes it cannot be named the weakest"
            : null,
        lien: `${BASE}/funnel-economics/`,
    };
}
/**
 * La reprise : ce que coûte le travail refait.
 *
 * Avec leur journal, tout est à eux. Sans lui, la *forme* du processus reste celle du
 * dépôt — la part de dossiers qui repassent, les minutes qu'ils coûtent — et seule
 * l'échelle est la leur. Les deux cas donnent un montant ; un seul donne une mesure, et
 * l'étiquette le dit.
 */
function repriseCoutee(e) {
    const dossiers = e.dossiersParAn;
    const coutHoraire = e.coutHoraireCharge;
    if (!dossiers || !coutHoraire)
        return null;
    const propre = !!e.journal?.evenements.length;
    const evenements = propre ? e.journal.evenements : journalDemo();
    const temps = perCase(evenements);
    if (!temps.length)
        return null;
    /*
     * `null` quand aucun dossier n'est passé sans reprise : il n'existe alors pas de dossier
     * de référence, et le surcoût n'est pas calculable. Se taire est la bonne réponse — c'est
     * ce cas-là, rencontré sur un journal étranger, qui a fait corriger le modèle d'origine.
     */
    const r = costOfRework(temps, { ...CYCLE, casesPerYear: dossiers, loadedHourlyCost: coutHoraire });
    if (!r || !(r.extraCostPerYear > 0))
        return null;
    const heures = Math.round(r.extraHoursPerYear);
    /*
     * La phrase sur le délai n'est dite que si elle apprend quelque chose.
     *
     * Sur des dossiers courts, l'avant et l'après se confondent une fois arrondis au dixième
     * de jour, et la page annonçait « de 0,3 à 0,3 jours » — une phrase qui use la confiance
     * du lecteur sans rien lui donner.
     */
    const avant = r.meanDaysBefore.toFixed(1), apres = r.meanDaysIfNoRework.toFixed(1);
    const delai = avant !== apres;
    return {
        outil: "cycle",
        cle: "reprise",
        montant: r.extraCostPerYear,
        nature: "déjà payé",
        unite: "a year, in work done twice",
        provenance: propre ? "vôtre" : "supposé",
        phrase: `${(r.share * 100).toFixed(0)} % of cases come back at least once, and redoing them costs ${heures.toLocaleString("en-GB")} analyst hours a year.`
            + (delai ? ` Removing the loop would take the average case from ${avant} to ${apres} days.` : ""),
        reserve: propre
            ? null
            : "the share of cases that come back is measured on this repository's event log, not yours — only the volume and the hourly cost are yours",
        lien: `${BASE}/process-cycle-time/`,
    };
}
/**
 * Le triage : le temps d'analyste passé sur ce qu'une règle déciderait.
 *
 * La part automatisable vient d'une mesure faite une fois, sur les quatre cents dossiers du
 * dépôt. Elle n'est pas la leur et ne peut pas l'être sans leur jeu de cas — d'où
 * l'étiquette, qui ne bougera pas tant qu'ils n'auront pas fourni de quoi la mériter.
 */
function revueEvitable(e) {
    const dossiers = e.entreesEnRelationParAn;
    const minutes = e.minutesRevueParDossier;
    const coutHoraire = e.coutHoraireCharge;
    const part = e.mesures?.triagePartAutomatisee;
    if (!dossiers || !minutes || !coutHoraire || !part)
        return null;
    const montant = dossiers * part * (minutes / 60) * coutHoraire;
    if (!(montant > 0))
        return null;
    const sur = e.mesures?.triageDossiers ?? 400;
    return {
        outil: "triage",
        cle: "revue",
        montant,
        nature: "déjà payé",
        unite: "a year, in reviews a rule could decide",
        provenance: "supposé",
        phrase: `On a comparable case set, ${(part * 100).toFixed(0)} % of files were decided without a human and without a single uncontrolled onboarding. At your volume, that is ${Math.round(dossiers * part).toLocaleString("en-GB")} files a year an analyst never has to open.`,
        reserve: `the automatable share is measured on this repository's ${sur} synthetic cases, not on yours — your own mix of sectors and countries would move it`,
        lien: `${BASE}/kyc-triage-agent/`,
    };
}
export function lireJournal(texte, retour) {
    const lignes = texte.split(/\r?\n/).filter((l) => l.trim() !== "");
    const ignorees = [];
    if (!lignes.length)
        return { evenements: [], activites: [], ignorees, minutesFournies: false };
    const decouper = (l) => l.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const tete = decouper(lignes[0]).map((c) => c.toLowerCase());
    const trouver = (motif, defaut) => {
        const i = tete.findIndex((c) => motif.test(c));
        return i >= 0 ? i : defaut;
    };
    const entete = tete.some((c) => /case|dossier|activit|step|time|date/.test(c));
    const cDossier = entete ? trouver(/case|dossier|id/, 0) : 0;
    const cActivite = entete ? trouver(/activit|step|etape|event/, 1) : 1;
    const cQuand = entete ? trouver(/time|date|horod|at$/, 2) : 2;
    const cMinutes = entete ? tete.findIndex((c) => /minute|duration|touch|duree/.test(c)) : -1;
    const brut = [];
    for (let n = entete ? 1 : 0; n < lignes.length; n++) {
        const cel = decouper(lignes[n]);
        const dossier = cel[cDossier] ?? "";
        const activite = cel[cActivite] ?? "";
        const t = cel[cQuand] ?? "";
        const quand = /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Date.parse(t) / 60000;
        if (!dossier) {
            ignorees.push({ ligne: n + 1, raison: "no case identifier" });
            continue;
        }
        if (!activite) {
            ignorees.push({ ligne: n + 1, raison: "no activity" });
            continue;
        }
        if (!Number.isFinite(quand)) {
            ignorees.push({ ligne: n + 1, raison: `timestamp “${t}” not understood` });
            continue;
        }
        /*
         * LA CELLULE VIDE AVANT LA CONVERSION — et le déchet se REFUSE, il ne devient pas zéro.
         *
         * `Number("")` vaut 0 : une cellule de minutes vide entrait comme « zéro minute
         * travaillée », indiscernable d'un vrai zéro écrit. Pire : une cellule CORROMPUE
         * (`"abc"`) donnait NaN, que le repli posait aussi à 0 — le mécanisme d'écart existe
         * trois lignes plus haut, et cette valeur-là n'y arrivait jamais. Septième dépôt de la
         * même famille, mesurée le 27/08/2026.
         *
         * La sémantique : colonne absente OU cellule vide = « pas de mesure de travail » (0,
         * assumé — c'est la convention déclarée de la colonne optionnelle) ; cellule remplie
         * mais illisible = ligne ÉCARTÉE en le disant, comme un horodatage incompris.
         */
        const brutMinutes = cMinutes >= 0 ? (cel[cMinutes] ?? "").trim() : "";
        const m = brutMinutes === "" ? 0 : Number(brutMinutes);
        if (!Number.isFinite(m)) {
            ignorees.push({ ligne: n + 1, raison: `minutes “${brutMinutes}” not understood` });
            continue;
        }
        brut.push({ dossier, activite, quand, minutes: m });
    }
    if (!brut.length)
        return { evenements: [], activites: [], ignorees, minutesFournies: false };
    /* Les horodatages deviennent des minutes depuis le début du journal. */
    const debut = Math.min(...brut.map((b) => b.quand));
    brut.sort((a, b) => a.quand - b.quand);
    const activites = [...new Set(brut.map((b) => b.activite))];
    const evenements = brut.map((b) => ({
        caseId: b.dossier,
        activity: (retour && b.activite === retour ? "information requested" : b.activite),
        at: b.quand - debut,
        touchMinutes: b.minutes,
        actor: "—",
    }));
    return { evenements, activites, ignorees, minutesFournies: cMinutes >= 0 };
}
export function diagnostiquer(e) {
    const { separation, niveau, refus } = separationPour(e);
    const constats = [capaciteInutilisee(e, separation), repriseCoutee(e), revueEvitable(e), entonnoir(e)]
        .filter((c) => c !== null);
    /* Le niveau atteint requalifie ce que le volet détection a le droit d'affirmer. */
    for (const c of constats) {
        if (c.outil !== "economics")
            continue;
        c.provenance = niveau === 3 ? "vôtre" : niveau === 2 ? "ajusté" : "supposé";
        c.reserve = niveau === 3 ? null
            : niveau === 2
                ? "the noise distribution comes from your numbers; the signal side depends on the share of reportable operations, which nobody can observe"
                : "the shape of the population is this repository's, scaled to your volume — a demonstration of method, not a measurement of your institution";
    }
    const parMontant = (a, b) => b.montant - a.montant;
    return {
        dejaPaye: constats.filter((c) => c.nature === "déjà payé").sort(parMontant),
        aGagner: constats.filter((c) => c.nature === "à gagner").sort(parMontant),
        niveau, refus, separation,
    };
}

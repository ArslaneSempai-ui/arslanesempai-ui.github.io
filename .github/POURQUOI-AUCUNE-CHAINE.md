# Pourquoi ce dépôt n'a pas de chaîne d'intégration continue

**Décidé et mesuré le 27 août 2026.** Écrit ici pour que personne ne le retente en croyant
l'inventer — les dix autres dépôts du portfolio en ont une depuis ce soir, et l'absence
d'un fichier ne dit jamais pourquoi il est absent.

## Ce qui a été mesuré

La suite a été lancée dans un arbre de travail isolé, hors de `~/Documents`, sans les dépôts
voisins sur le disque — c'est-à-dire dans les conditions exactes d'un runner. Résultat :

    78 cas · 60 passés · 5 fichiers en ÉCHEC · 13 abstentions

Les cinq échecs ne sont pas des cas mais des **fichiers entiers** — `certification`,
`compter`, `portefeuille`, `profil`, `textes` — qui lèvent au chargement sur la même cause :
`la liste des dépôts est illisible`. Ils lisent `../../identite/depots.json`, un dépôt privé
de développement qui ne vit sur aucun runner.

## Pourquoi ce n'est pas un défaut à corriger

**C'est le seul dépôt du portfolio dont le travail EST de parler des autres.** Il certifie
que chaque outil annonce sa démo, que les chiffres de chaque README concordent avec sa
mesure, qu'aucune page ne pointe vers le dépôt gardé privé. Ces questions n'ont pas de
réponse quand les autres dépôts ne sont pas là — et une réponse rendue sans eux serait un
vert vide, pas un vert.

Rendre ces fichiers abstinents ferait tourner une chaîne qui ne vérifierait presque rien,
tout en portant la marque verte qui dit le contraire. Un contrôle qui atteste moins que ce
que son voyant laisse croire est pire que pas de contrôle.

## Où ce dépôt est réellement vérifié

Au **crochet de pré-commit**, sur une machine qui porte le portfolio entier — c'est-à-dire
la seule où ces questions se posent. C'est la même décision que pour le contrôle de couche
partagée, et pour la même raison : *le domicile d'un contrôle est l'endroit où il peut
répondre, pas celui où il serait le plus visible.*

## Ce qui rouvrirait la question

Une chaîne qui reconstituerait le portfolio — clonage des dépôts publics voisins — pourrait
faire tourner ces cinq fichiers pour de vrai. Ce serait un gain réel, pas un vert de façade.
Le coût est un clonage multiple à chaque passe, et la question de `identite`, qui est privé
et ne se clone pas depuis un dépôt public sans y poser un secret.

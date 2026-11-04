# Barre de retouche flottante sous l'image

Statut : `ready-for-agent`, publiée dans guillaume-murat/NanoThumbnail#1.

## Problem Statement

Pour retoucher une miniature, le créateur regarde l'image au centre de l'écran, mais il doit aller chercher les outils, les suggestions et le champ de prompt dans le panneau de droite. L'action est loin de ce qu'elle modifie : les yeux et la souris font sans cesse l'aller-retour.

Ce panneau mélange aussi deux choses : agir sur l'image (outils, prompt) et consulter ce qui a déjà été fait (versions). Enfin, les réglages de l'outil actif s'affichent ailleurs, sous l'image, alors que l'outil se choisit à droite.

## Solution

Une **barre de retouche** flottante apparaît par défaut sous l'image, comme la barre contextuelle de Photoshop, et le créateur peut la déplacer. Elle réunit le champ de prompt, les quatre outils, le menu de suggestions, le bouton œil et l'envoi.

Quand un outil est actif, ses réglages s'affichent dans cette même barre. Le panneau de droite ne garde que les versions, sous le nom **Historique**.

```
┌─────────────────────── image ───────────────────────┐
│                                                     │
└─────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────┐
  ⋮ Décrivez ce que vous souhaitez changer…         │
  ⋮ T Texte  ↗ Flèche  🖌 Zone  ⤢ Recadrer │ Suggestions ▴   👁  ↑ │
  └─────────────────────────────────────────────────┘
┌──────────────── bande des miniatures ───────────────┐
```

## User Stories

### Retoucher depuis l'image

1. En tant que créateur, je veux le champ de prompt sous l'image, afin de décrire une retouche sans quitter l'image des yeux.
2. En tant que créateur, je veux que la barre apparaisse dès qu'une image est sélectionnée dans la vue Image, afin de pouvoir retoucher tout de suite.
3. En tant que créateur, je veux que la barre disparaisse quand aucune image n'est sélectionnée, afin de ne pas voir d'actions impossibles.
4. En tant que créateur, je veux envoyer avec Entrée et passer à la ligne avec Maj+Entrée, afin de garder les gestes actuels.
5. En tant que créateur, je veux que le champ grandisse avec mon texte jusqu'à une hauteur limite puis défile, afin de lire un long prompt sans perdre l'image.
6. En tant que créateur, je veux que le champ se vide après l'envoi, afin de préparer la retouche suivante.
7. En tant que créateur, je veux retrouver mon texte non envoyé après être passé par une autre vue, afin de ne pas perdre ce que j'ai écrit.

### Déplacer la barre

8. En tant que créateur, je veux une poignée pour déplacer la barre, afin de dégager la partie de l'image que je veux voir.
9. En tant que créateur, je veux que la barre soit placée sous l'image par défaut, afin que l'image ne soit pas couverte tant que je ne l'ai pas déplacée.
10. En tant que créateur, je veux que la barre reste entièrement dans la zone centrale, afin de ne jamais la perdre hors de l'écran.
11. En tant que créateur, je veux qu'elle reste accessible quand je redimensionne la fenêtre ou un panneau, afin de ne jamais avoir à la chercher.
12. En tant que créateur, je veux retrouver sa position après un rechargement, afin de ne pas la replacer à chaque session.
13. En tant que créateur, je veux la remettre à sa place par défaut d'un double-clic sur la poignée, afin de revenir facilement à la disposition d'origine.
14. En tant que créateur, je veux que peindre, zoomer ou déplacer l'image ne soit pas déclenché quand je manipule la barre, afin d'éviter les gestes involontaires.

### Outils

15. En tant que créateur, je veux chaque outil avec son icône et un libellé court (Texte, Flèche, Zone, Recadrer), afin de les reconnaître sans les survoler.
16. En tant que créateur, je veux n'avoir que les icônes quand la place manque, avec le nom et le raccourci en infobulle, afin que la barre tienne dans une petite fenêtre.
17. En tant que créateur, je veux garder les raccourcis T, A, M et R ainsi que Esc, afin de travailler aussi vite qu'aujourd'hui.
18. En tant que créateur, je veux voir quel outil est actif, afin de savoir dans quel mode je suis.

### Barre selon l'outil actif

19. En tant que créateur, je veux que les réglages de Texte, Flèche et Recadrer remplacent toute la barre, afin de ne pas voir un prompt que ces outils n'utilisent pas.
20. En tant que créateur, je veux retrouver le champ et mon texte en quittant ces outils, afin de reprendre ma retouche.
21. En tant que créateur, je veux pour l'outil Zone les réglages (pinceau, gomme, taille, effacer, Lisser, Correcteur IA) sous le champ, afin de peindre puis de décrire le changement au même endroit.
22. En tant que créateur, je veux que le champ indique quand une zone peinte sera modifiée, afin de savoir que le changement est limité à cette zone.
23. En tant que créateur, je veux que la barre garde sa position quand l'outil change et reste entièrement visible même si elle grandit, afin qu'elle ne saute pas et ne sorte pas de l'écran.

### Suggestions

24. En tant que créateur, je veux un menu « Suggestions » dans la barre, afin d'avoir des idées sans perdre de hauteur d'image.
25. En tant que créateur, je veux que le menu s'ouvre vers le haut, ou vers le bas si la barre est en haut de la zone, afin qu'il reste entièrement visible.
26. En tant que créateur, je veux qu'un clic sur une suggestion remplace le contenu du champ et ne lance rien, afin de relire avant de dépenser un appel au modèle.
27. En tant que créateur, je veux que le curseur aille dans le champ après ce clic, afin de compléter ou d'envoyer tout de suite.

### Voir le prompt

28. En tant que créateur, je veux garder le bouton œil, identique à celui du panneau de gauche, afin de vérifier le prompt, les images, la zone peinte et le modèle avant l'envoi.

### Historique

29. En tant que créateur, je veux que le panneau de droite s'appelle « Historique » et montre l'arbre des versions, afin de voir ce qui a été fait et d'y revenir.
30. En tant que créateur, je veux pouvoir sélectionner une ancienne version et la retoucher depuis la barre, afin de repartir d'une étape précédente.

### Vues et états

31. En tant que créateur, je veux que la barre n'existe que dans la vue Image, afin que les aperçus du fil, de la chaîne et la comparaison gardent toute leur place.
32. En tant que créateur, je veux que le studio reste verrouillé pendant un appel au modèle, barre comprise, afin de ne pas lancer une action contradictoire.
33. En tant que créateur, je veux que les erreurs, le favori, l'export et le menu « … » ne soient pas cachés par la barre à sa place par défaut, afin de les garder accessibles.

### Mobile

34. En tant que créateur sur téléphone, je veux la barre fixe sous l'image, sans déplacement, afin de ne pas gêner le tactile.
35. En tant que créateur sur téléphone, je veux rester sur l'image quand je retouche, afin de suivre le résultat sans changer d'onglet.
36. En tant que créateur sur téléphone, je veux un onglet « Historique » à la place de « Itérer », afin de retrouver les versions.

## Implementation Decisions

### Modules

- **Barre de retouche (nouveau composant)** : rendue par la zone centrale, au-dessus du corps de la vue et hors de son flou. Elle n'existe que si la vue est Image et qu'une image est sélectionnée.
- **Position de la barre (nouveau module pur, sans DOM)** : calcule la position par défaut, borne une position dans la zone disponible et la recalcule quand cette zone ou la barre change de taille. C'est le seul endroit qui contient cette logique.
- **Panneau des retouches** : réduit à l'Historique. Les outils, les suggestions, le champ et le dialogue de prompt en sortent, et les titres « Outils », « Suggestions » et « Prompter une retouche » disparaissent.
- **Zone centrale** : ne contient plus de rangées de réglages sous l'image. Les réglages de l'outil Zone et les barres Texte, Flèche et Recadrer passent dans la barre de retouche.

### Comportements

- **Position** : par défaut, centrée en bas de la zone centrale. Elle est stockée dans les préférences de l'appareil (`nt_prefs`), donc commune à tous les projets et absente des sauvegardes. La réinitialisation de l'app l'efface déjà avec ces préférences.
- **Place de l'image** : le calcul d'ajustement de l'image et du recadrage réserve une hauteur fixe pour la barre, qu'elle ait été déplacée ou non, afin que l'image ne change pas de taille pendant un déplacement. La barre peut donc couvrir l'image uniquement si le créateur l'y a déplacée.
- **Déplacement** : par la poignée seule, avec les événements de pointeur. La barre capte ses propres événements (peinture, pincement, molette) et ne les transmet pas à l'image.
- **Instruction** : son texte non envoyé vit hors de la barre, pour survivre à un changement de vue ou d'outil, mais il n'est pas sauvegardé au rechargement. L'envoi passe toujours par l'action de retouche existante.
- **Outil actif** : Texte, Flèche et Recadrer remplacent la barre entière. Zone garde le champ et remplace la ligne des outils par ses réglages. Esc reste le moyen de quitter un outil.
- **Suggestions** : menu standard ouvert vers le haut, avec bascule automatique s'il n'y a pas la place. Le comportement au clic reste le remplacement actuel du champ, avec le curseur placé dedans. Le texte reste en italique.
- **Commandes** : la liste des outils reste celle des commandes partagées avec la palette et les raccourcis, avec un libellé court ajouté pour la barre.
- **Actions sur l'image** : favori, export et « … » passent en haut à droite de la vue pour libérer le bas. Les erreurs de génération et l'aide de l'outil Zone s'affichent au-dessus de la place par défaut de la barre.
- **Mobile** : en dessous du point de rupture du studio, la barre est dans le flux sous l'image, pleine largeur et sans poignée. Le bouton « Décrire la zone » et les changements d'onglet après une retouche ou un outil disparaissent, car tout se passe au même endroit.
- **Vocabulaire** : « Versions » devient « Historique » comme titre du panneau et onglet mobile. Les interfaces française et anglaise changent ensemble (« Historique » et « History »).
- **Prompt** : le contenu envoyé au modèle ne change pas, ni le dialogue de l'œil.

### Glossaire à créer (`GLOSSARY.md`)

- **Barre de retouche** : la barre flottante sous l'image qui réunit les actions de retouche.
- **Outil** : un mode de travail direct sur l'image (Texte, Flèche, Zone, Recadrer).
- **Instruction** : le texte libre qui décrit une retouche au modèle.
- **Suggestion** : une instruction prête à l'emploi, à relire avant envoi.
- **Historique** : l'arbre des versions d'une miniature.

## Testing Decisions

- Un bon test vérifie ce qu'on observe depuis l'extérieur d'un module, à partir de ses entrées et sorties, et ne dépend pas de sa structure interne.
- **Module testé en priorité : position de la barre.**
  - position par défaut, centrée en bas ;
  - position gardée telle quelle si elle tient ;
  - position bornée sur chaque bord ;
  - position recalée après un rétrécissement de la zone ou un agrandissement de la barre ;
  - zone plus petite que la barre, sans valeur aberrante ;
  - position enregistrée invalide ou absente, qui revient à la valeur par défaut.
- **Tests existants à garder** : commandes (une lettre par commande, à étendre au libellé court de chaque outil), prompt et versions.
- **Modèles de tests** : les tests purs du zoom et du recadrage, qui couvrent déjà une géométrie relative à une zone.
- **Vérification manuelle dans l'app de test** (le dépôt n'a pas d'environnement de test DOM, et ces tests n'en ajoutent pas) :
  - déplacement, double-clic et rechargement ;
  - changement de taille de la fenêtre et des panneaux ;
  - les quatre outils et le retour au champ ;
  - clic sur une suggestion, sans appel au modèle ;
  - bouton œil ;
  - largeur mobile ;
  - app macOS (WebKit), en particulier pour le pointeur et le pincement.

## Out of Scope

- Changer le contenu du prompt, les suggestions proposées ou le comportement des outils.
- Choisir le modèle dans la barre, comme le fait Photoshop : il reste dans les options avancées, et l'œil l'affiche.
- Déplacer l'Historique dans une bande horizontale ou supprimer le panneau de droite.
- Afficher la barre dans les vues Aperçu du fil, Aperçu de la chaîne et Comparer.
- Rendre le panneau de gauche flottant, ou mémoriser le pliage de ses sections.
- Enregistrer une position par projet.

## Further Notes

- **Décisions prises sans validation explicite**, faute de tour de questions supplémentaire : l'adaptation mobile, la position des actions sur l'image (en haut à droite), la mémorisation de la position par appareil, le double-clic de remise à zéro et la réservation de hauteur fixe pour l'image. Elles restent à relire.
- **Conséquence de la vue Image seule** : il faudra revenir à cette vue pour lancer une retouche depuis un aperçu.
- **Conséquence de la réservation** : l'image perd de la hauteur en permanence, environ 90 px à confirmer une fois la barre construite, plus la marge. Les rangées de réglages supprimées en rendent une partie quand un outil est actif.
- **Largeur** : la barre Texte contient beaucoup de réglages. Dans une zone centrale étroite, elle doit passer à la ligne, sans déborder.
- **Lien avec le travail récent** : ces changements annulent les titres et l'emplacement ajoutés récemment dans le panneau de droite, encore non commités. Il vaut mieux commiter cet état d'abord, pour que cette évolution ait son propre diff.

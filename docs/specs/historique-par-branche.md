# Historique par branche

Statut : `ready-for-agent`, publiée dans guillaume-murat/NanoThumbnail#6.

## Problem Statement

Une miniature retouchée plusieurs fois donne un long escalier dans le panneau Historique. Le créateur trouve ce panneau trop large et fouillis, même depuis que le décalage est passé à 5 px. Chaque étape occupe une ligne, y compris quand plusieurs étapes du même outil se suivent et se ressemblent. Il lit mal les embranchements : une version qui repart d'une ancienne étape se retrouve tout en bas, reliée par une longue ligne pointillée qu'il faut suivre du regard.

Le créateur ne peut pas non plus retirer une branche ratée depuis le panneau. La seule suppression existante, dans le menu « … » de l'image, retire une version sans demander de confirmation. Ses suites perdent alors leur lien et deviennent une miniature séparée.

## Solution

L'Historique affiche une seule **branche** à la fois, en liste droite et sans décalage, de l'originale jusqu'à la dernière version de cette branche. Une version d'où partent plusieurs suites, un **embranchement**, porte un repère visible. Un clic sur ce repère liste les branches et permet de passer à l'une d'elles.

Les étapes consécutives du même outil se regroupent en une ligne dépliable, par exemple « Flèche × 4 », dont la vignette montre la dernière étape.

Chaque version peut être supprimée, après confirmation, avec tout ce qui en découle.

```
▣ Originale
▣ Texte
▣ Flèche                 ⑂ 2 branches
▣ Texte
▣ Flèche × 4             ⌄
▣ Texte
▣ Recadrage              ← version en cours
```

## User Stories

### Lire l'historique

1. En tant que créateur, je veux une liste droite sans décalage, afin que le panneau reste étroit quel que soit le nombre de versions.
2. En tant que créateur, je veux voir les versions de l'originale vers la plus récente, afin de suivre le travail dans l'ordre où il s'est fait.
3. En tant que créateur, je veux voir uniquement la branche sur laquelle je travaille, afin de ne pas être gêné par les essais abandonnés.
4. En tant que créateur, je veux reconnaître tout de suite la version en cours, afin de savoir d'où partira la prochaine retouche.
5. En tant que créateur, je veux que la version en cours reste visible dans le panneau quand elle change, afin de ne pas la chercher dans une longue liste.
6. En tant que créateur, je veux garder le nombre total de versions de la miniature dans le titre du panneau, afin de savoir que d'autres versions existent hors de la branche affichée.
7. En tant que créateur, je veux que chaque ligne garde sa vignette, son outil et son instruction, afin de reconnaître une étape comme aujourd'hui.

### Embranchements

8. En tant que créateur, je veux un repère bien visible sur chaque embranchement, afin de savoir où d'autres branches existent sans les voir toutes.
9. En tant que créateur, je veux que ce repère indique le nombre de branches, afin d'estimer ce qui est masqué.
10. En tant que créateur, je veux ouvrir la liste des branches depuis ce repère, afin de choisir celle où continuer.
11. En tant que créateur, je veux voir pour chaque branche sa première étape, sa dernière vignette et son nombre de versions, afin de les distinguer.
12. En tant que créateur, je veux voir quelle branche est affichée dans cette liste, afin de me repérer.
13. En tant que créateur, je veux qu'en choisissant une branche, sa dernière version devienne la version en cours, afin de reprendre là où elle s'était arrêtée.
14. En tant que créateur, je veux que cliquer sur une ancienne version de la branche laisse la liste en place, afin de pouvoir revenir en arrière sans perdre de vue la suite.
15. En tant que créateur, je veux qu'une retouche depuis une ancienne version crée une nouvelle branche et l'affiche, afin de voir le résultat de ce que je viens de faire.
16. En tant que créateur, je veux retrouver sa branche quand je sélectionne une version depuis ailleurs, afin que le panneau suive toujours l'image affichée.

### Regroupement

17. En tant que créateur, je veux que plusieurs étapes consécutives du même outil forment une seule ligne, afin de raccourcir la liste.
18. En tant que créateur, je veux lire l'outil et le nombre d'étapes sur cette ligne, par exemple « Flèche × 4 », afin de comprendre ce qu'elle contient.
19. En tant que créateur, je veux que la vignette du groupe montre sa dernière étape, afin de voir son résultat.
20. En tant que créateur, je veux qu'un clic sur la ligne du groupe sélectionne sa dernière étape, afin de reprendre le résultat sans déplier.
21. En tant que créateur, je veux déplier le groupe avec un contrôle distinct, afin d'atteindre une étape intermédiaire.
22. En tant que créateur, je veux qu'un groupe contenant la version en cours soit déplié si cette version n'est pas sa dernière étape, afin de toujours la voir.
23. En tant que créateur, je veux que les retouches décrites par une instruction restent séparées, afin de lire chacune de mes demandes.
24. En tant que créateur, je veux qu'un embranchement reste une ligne visible, afin que son repère ne soit jamais caché dans un groupe.

### Supprimer

25. En tant que créateur, je veux supprimer une version depuis sa ligne, afin de retirer un essai raté.
26. En tant que créateur, je veux que ce qui en découle soit supprimé avec elle, afin de ne jamais laisser des versions sans origine.
27. En tant que créateur, je veux une confirmation indiquant combien de versions seront supprimées, afin de ne pas perdre du travail par erreur.
28. En tant que créateur, je veux que la confirmation signale qu'il n'y a pas de retour en arrière, afin de décider en connaissance de cause.
29. En tant que créateur, je veux que la version d'origine de ce que j'ai supprimé devienne la version en cours si la version en cours a disparu, afin de continuer sans rupture.
30. En tant que créateur, je veux que supprimer l'originale supprime toute la miniature après le même avertissement, afin que la règle reste la même partout.
31. En tant que créateur, je veux que le « Supprimer » du menu de l'image suive la même règle, afin qu'aucune suppression ne coupe une miniature en deux.
32. En tant que créateur, je veux déplier un groupe pour supprimer une de ses étapes, afin de voir ce que je retire.
33. En tant que créateur, je veux que les versions supprimées disparaissent aussi de ma sélection pour le test et des emplacements de l'aperçu de la chaîne, afin de ne pas retrouver de trou ou d'image disparue.
34. En tant que créateur, je ne veux pas pouvoir supprimer pendant un appel au modèle, afin que le résultat attendu garde sa version d'origine.
35. En tant qu'agent connecté par MCP, je ne dois toujours pas pouvoir supprimer une version, afin que le créateur garde seul cette décision.

### Autres contextes

36. En tant que créateur sur mobile, je veux le même historique dans son onglet, afin de retrouver les mêmes repères.
37. En tant que créateur, je veux que le repère, le dépliage et la suppression restent accessibles au clavier et au toucher, afin de ne pas dépendre du survol.
38. En tant que créateur, je veux retrouver mes anciennes miniatures sans migration, afin que rien ne change dans mes données.
39. En tant que créateur anglophone, je veux tous ces libellés en anglais, afin d'avoir une interface cohérente.

## Implementation Decisions

- **Modèle de données inchangé** : les versions restent reliées par leur version d'origine. Une branche et un groupe se calculent à l'affichage. Rien de nouveau n'est enregistré, donc ni migration ni changement de sauvegarde.
- **Branche affichée** : elle part de l'originale, passe par la version en cours, puis continue jusqu'à une version sans suite. Après la version en cours, à chaque embranchement, elle suit la suite la plus récente.
- **Stabilité de la branche** : tant que la version en cours appartient à la branche affichée, celle-ci ne change pas. Revenir sur un embranchement depuis une ancienne branche ne fait donc pas basculer la liste vers la branche la plus récente. La branche retenue vit dans le panneau et n'est pas enregistrée : après un rechargement, la règle de la suite la plus récente s'applique.
- **Changement de branche** : choisir une branche sélectionne sa dernière version, en suivant la suite la plus récente à chaque embranchement rencontré.
- **Repère d'embranchement** : il apparaît sur toute version de la branche affichée qui a au moins deux suites. Son menu liste une entrée par suite, avec la première étape, la vignette de la dernière version et le nombre de versions de cette branche.
- **Règle de regroupement** : au moins deux versions consécutives de la branche affichée, ayant la même étape (l'outil ou le type qui nomme déjà la version). Sont exclus l'originale et les retouches décrites par une instruction, entières ou de zone, dont le texte est le contenu même. Une version avec un repère d'embranchement termine le groupe et reste visible. Un groupe contenant la version en cours sur une étape intermédiaire s'affiche déplié. L'état déplié n'est pas enregistré.
- **Suppression** : une seule action du magasin supprime une version et tous ses descendants, libère les images devenues inutilisées et retire ces versions de la sélection pour le test. L'action actuelle, qui ne retire qu'une version, disparaît. Le panneau et le menu « … » de l'image passent tous deux par elle, avec la même confirmation.
- **Après une suppression** : si la version en cours a disparu, sa remplaçante est la version d'origine de la version supprimée. Si toute la miniature a disparu, la sélection reprend la règle actuelle.
- **Emplacements de l'aperçu de la chaîne** : une version supprimée libère son emplacement, qui est rempli selon la règle existante.
- **Verrouillage** : la suppression suit le verrouillage du studio pendant un appel au modèle.
- **Module de calcul** : le module pur des versions gagne le calcul de la branche affichée, des lignes de l'historique (versions, groupes et repères) et des descendants d'une version. Le calcul de l'arbre complet et de ses lignes pointillées disparaît s'il n'a plus d'usage.
- **Agents** : aucun outil MCP de suppression n'est ajouté. Le panneau ne change rien aux outils existants.
- **Langues** : tous les nouveaux textes passent par les dictionnaires français et anglais.

## Testing Decisions

- **Ce qui fait un bon test** : il vérifie ce que le créateur obtient à partir d'un arbre de versions (quelles lignes, quels groupes, quelle branche, quelles versions supprimées), avec des résultats écrits à la main, sans dépendre de la façon de les calculer.
- **Point de test unique** : le module pur des versions, déjà testé. Les cas à couvrir :
  - branche d'une version en cours au milieu, sur une feuille, ou sur une miniature sans retouche ;
  - stabilité quand la version en cours change dans la branche retenue, et bascule quand elle en sort ;
  - choix de la suite la plus récente à chaque embranchement ;
  - dernière version d'une branche choisie dans le menu ;
  - repère et décompte des versions par branche ;
  - groupes : minimum de deux, outils différents, exclusions, embranchement qui termine un groupe, groupe déplié autour de la version en cours ;
  - descendants d'une version, y compris l'originale et une version sans suite ;
  - remplaçante de la version en cours après suppression.
- **Antériorité** : les tests actuels des versions, de `treeLines` et de `newGeneration` servent de modèle.
- **Sans test automatique** : le projet n'a pas d'environnement DOM. Le panneau, le menu de branches, la confirmation et le défilement se vérifient dans l'app de test, sur un historique long avec embranchements, puis dans l'app macOS (WebKit).

## Out of Scope

- La comparaison visuelle entre deux versions.
- Nommer ou annoter une version.
- La suppression d'une version seule en reliant ses suites à la version précédente.
- La restauration après suppression.
- Un tri ou une recherche dans l'historique.
- Une vue de l'arbre complet en plus de la branche affichée.
- Le déplacement de l'historique sous l'image.
- La bande des miniatures du projet, dont le comptage ne change pas.

## Further Notes

- **Choix à relire**, déduits de tes réponses sans question supplémentaire :
  - les retouches avec instruction ne se regroupent pas ;
  - un embranchement termine un groupe ;
  - la branche affichée reste stable tant que la version en cours en fait partie ;
  - la suppression de l'originale retire toute la miniature ;
  - la suppression du menu « … » change de comportement et demande une confirmation.
- **Données anciennes** : des versions orphelines peuvent déjà exister si une suppression a coupé une miniature. Elles restent traitées comme des originales séparées : on ne peut pas retrouver leur ancien lien.
- **Risque** : les branches masquées ne se voient plus d'un coup d'œil. Le repère et le total affiché dans le titre doivent suffire à le rappeler, à vérifier à l'usage.

# Historique simple

Statut : `ready-for-agent`, publiée dans guillaume-murat/NanoThumbnail#10.

## Problem Statement

Le créateur trouve l'historique par branches trop complexe pour un utilisateur ordinaire. Il doit comprendre qu'une retouche depuis une ancienne version crée une branche, que d'autres branches existent hors de la liste, et comment passer de l'une à l'autre. Il ne cherche pas à gérer un arbre : il veut suivre ses retouches, pouvoir revenir en arrière, et partir d'une version pour explorer une autre idée.

La suppression d'une ligne de l'historique n'a pas non plus de sens pour lui. Et les données actuelles contiennent des embranchements et des restes d'anciens formats, qui compliqueraient ce modèle plus simple.

## Solution

Une miniature a **une seule suite de versions**, sans branche. Le panneau de droite affiche cet historique, de l'originale à la dernière version.

Au survol d'une ligne, deux boutons apparaissent par-dessus son texte :

- **Revenir à cette version** : après un avertissement, supprime les versions plus récentes et reprend depuis celle-ci.
- **Dupliquer en nouvelle miniature** : après confirmation, crée une miniature indépendante à partir de cette version.

Cliquer sur une ligne affiche cette version au centre, sans rien modifier. Tant qu'une ancienne version est affichée, aucune retouche n'est possible : il faut revenir à cette version ou rouvrir la dernière.

L'app repart sur une base de données neuve, sans aucune reprise des anciennes données.

```
▣ Originale                   
▣ Texte            [↶] [⧉]    ← au survol, par-dessus le texte
▣ Flèche × 4          ⌄
▣ Texte
▣ Recadrage        ← dernière version, [⧉] seul
```

## User Stories

### Lire l'historique

1. En tant que créateur, je veux une liste droite de toutes les versions d'une miniature, afin de comprendre ce qui s'est passé sans notion de branche.
2. En tant que créateur, je veux voir les versions de l'originale vers la plus récente, afin de suivre le travail dans l'ordre.
3. En tant que créateur, je veux que les étapes consécutives du même outil restent regroupées, par exemple « Flèche × 4 », afin de garder une liste courte.
4. En tant que créateur, je veux déplier un groupe, afin d'atteindre l'une de ses étapes.
5. En tant que créateur, je veux que les retouches décrites par une instruction restent sur leur propre ligne, afin de lire chacune de mes demandes.
6. En tant que créateur, je veux reconnaître la version affichée, afin de savoir ce que je regarde.
7. En tant que créateur, je veux que la version affichée reste visible dans le panneau, afin de ne pas la chercher dans une longue liste.

### Voir une ancienne version

8. En tant que créateur, je veux cliquer sur une ligne pour voir sa version au centre, afin de l'examiner en grand avant de décider.
9. En tant que créateur, je veux que ce clic ne supprime rien, afin de pouvoir regarder sans risque.
10. En tant que créateur, je veux qu'un clic sur la dernière version rétablisse le travail en cours, afin de retrouver où j'en étais.
11. En tant que créateur, je veux que la barre de retouche m'indique que je regarde une ancienne version, afin de comprendre pourquoi je ne peux pas retoucher.
12. En tant que créateur, je veux trouver dans cette barre un bouton « Revenir à cette version », afin d'agir sans chercher la ligne.
13. En tant que créateur, je veux que les outils et l'envoi soient bloqués sur une ancienne version, y compris au clavier, afin de ne jamais créer de branche.
14. En tant que créateur, je veux retrouver mon instruction en cours après être revenu à la dernière version, afin de ne pas la retaper.
15. En tant que créateur, je veux pouvoir exporter l'ancienne version affichée, afin de récupérer une image sans rien perdre, sauf si l'export demande un agrandissement par le modèle.

### Revenir à une version

16. En tant que créateur, je veux un bouton « Revenir à cette version » sur chaque ligne sauf la dernière, afin de reprendre depuis une étape précédente.
17. En tant que créateur, je veux un avertissement indiquant combien de versions seront supprimées, afin de décider en connaissance de cause.
18. En tant que créateur, je veux que cet avertissement signale qu'il n'y a pas de retour en arrière, afin de ne pas perdre du travail par erreur.
19. En tant que créateur, je veux qu'après confirmation cette version devienne la dernière et soit affichée, afin de continuer aussitôt à retoucher.
20. En tant que créateur, je veux pouvoir revenir à l'originale, afin d'annuler toutes les retouches d'un coup.
21. En tant que créateur, je veux que les versions retirées quittent ma sélection pour le test et l'aperçu de la chaîne, afin de ne retrouver aucune image disparue.
22. En tant que créateur, je ne veux pas pouvoir revenir en arrière pendant un appel au modèle, afin que le résultat attendu garde sa version d'origine.

### Dupliquer

23. En tant que créateur, je veux un bouton « Dupliquer » sur chaque ligne, y compris la dernière, afin d'explorer une autre idée sans toucher à cette miniature.
24. En tant que créateur, je veux une confirmation avant de dupliquer, afin de ne pas créer de miniature par accident.
25. En tant que créateur, je veux que la nouvelle miniature parte de cette image comme originale, avec un historique neuf, afin qu'elle soit indépendante.
26. En tant que créateur, je veux qu'elle garde le titre de la vidéo et les réglages, afin de ne pas les ressaisir.
27. En tant que créateur, je veux voir la nouvelle miniature aussitôt après, afin de constater le résultat et de continuer dessus.
28. En tant que créateur, je veux la même confirmation au clic droit sur une tuile ou sur l'image, afin que le geste se comporte de la même façon partout.

### Afficher les boutons

29. En tant que créateur, je veux que les boutons apparaissent au survol, par-dessus le texte de la ligne, afin que le panneau reste épuré.
30. En tant que créateur, je veux que la ligne reste lisible quand ils apparaissent, afin de savoir sur quoi j'agis.
31. En tant que créateur au clavier, je veux que les boutons apparaissent quand j'y arrive, afin de ne pas dépendre de la souris.
32. En tant que créateur sur un écran tactile, je veux les voir en permanence, afin d'y accéder sans survol.
33. En tant que créateur, je veux que les boutons d'une ligne de groupe agissent sur sa dernière étape, afin que le résultat corresponde à la vignette affichée.

### Supprimer une miniature

34. En tant que créateur, je ne veux aucune suppression sur les lignes de l'historique, afin de garder une suite sans trou.
35. En tant que créateur, je veux supprimer une miniature entière depuis le menu « … » de l'image, afin de retirer un essai raté.
36. En tant que créateur, je veux la même action au clic droit sur une tuile de la bande du projet, afin de faire le tri au même endroit que mes miniatures.
37. En tant que créateur, je veux une confirmation indiquant le nombre de versions supprimées, afin de ne pas perdre du travail par erreur.

### Repartir sur une base neuve

38. En tant que créateur, je veux démarrer avec une app vide après la mise à jour, afin de ne garder aucun embranchement ni ancien format.
39. En tant que créateur, je veux conserver mes clés, mon fournisseur, ma langue et mes réglages d'app, afin de ne pas tout reconfigurer.
40. En tant que créateur, je veux pouvoir exporter un zip de mes images avant la mise à jour, afin d'en garder une archive.
41. En tant que créateur, je veux qu'un zip d'avant ce changement soit refusé avec un message clair, afin de comprendre pourquoi il ne s'importe pas.
42. En tant que créateur, je veux que « Réinitialiser l'application » libère aussi la place prise par les anciennes données, afin de ne pas les garder sans le savoir.

### Agents et langues

43. En tant qu'agent connecté par MCP, je veux pouvoir afficher une ancienne version, afin de la montrer au créateur.
44. En tant qu'agent, je veux une erreur claire si je tente de retoucher une ancienne version, afin de savoir que je dois repartir de la dernière.
45. En tant que créateur, je veux qu'un agent ne puisse ni revenir en arrière ni supprimer, afin de garder seul ces décisions.
46. En tant que créateur anglophone, je veux tous ces libellés en anglais, afin d'avoir une interface cohérente.

## Implementation Decisions

- **Modèle** : une miniature est une originale et une suite de versions, chacune ayant au plus une suite. Le lien vers la version précédente reste le même champ, sans nouvelle donnée.
- **Règle centrale** : toute nouvelle version part de la dernière version de sa miniature. Elle est vérifiée au point unique d'enregistrement des versions, en plus du blocage dans l'interface, pour qu'aucun chemin ne puisse créer d'embranchement.
- **Version affichée** : la sélection actuelle peut viser une version ancienne. Une version est ancienne si elle a une suite. Ce n'est qu'un état d'affichage, non enregistré comme tel.
- **Actions bloquées sur une ancienne version** : retouche, retouche de zone, Lisser, Correcteur IA, Texte, Flèche, Recadrer et agrandissement. Les commandes et leurs raccourcis passent par la même condition de disponibilité que les autres.
- **Export** : une ancienne version s'exporte normalement si aucun agrandissement n'est nécessaire. L'export 1920×1080 qui en demanderait un est indisponible, avec une explication.
- **Barre de retouche** : sur une ancienne version, elle montre « Ancienne version », « Revenir à cette version » et « Voir la dernière version ». L'instruction reste en mémoire et le champ est en lecture seule.
- **Revenir à une version** : une action du magasin supprime toutes les versions postérieures, en une seule transaction, libère les images inutilisées, retire ces versions de la sélection pour le test et efface le classement si elles en faisaient partie. Elle reprend le nettoyage des emplacements de l'aperçu de la chaîne. Elle est refusée pendant un appel au modèle.
- **Dupliquer** : l'action existante de copie indépendante reste, avec sa propre copie de l'image. Elle affiche désormais la nouvelle miniature. La ligne affiche « Originale » pour toute version sans précédente, quel que soit son type d'origine.
- **Confirmations** : un seul composant par action, utilisé depuis l'historique, le clic droit et la barre de retouche. Le décompte est figé pendant la fermeture.
- **Supprimer une miniature** : le « Supprimer l'image » du menu « … » devient « Supprimer la miniature » et s'ajoute au clic droit d'une tuile. Elle retire toutes ses versions, même depuis une ancienne version affichée.
- **Boutons de ligne** : ils se superposent à droite du texte, sur un fond qui le masque en partie, au survol et au focus, et restent visibles sur les écrans tactiles. Le contrôle de dépliage d'un groupe reste toujours visible.
- **Groupes** : la règle actuelle reste, sans le cas des embranchements. L'originale et les retouches avec instruction ne se regroupent jamais. Un groupe s'affiche déplié si la version affichée en est une étape intermédiaire. Revenir à une étape dépliée se fait depuis sa propre ligne.
- **Base neuve** : l'app utilise un nouveau nom de base de données, qui repart vide, avec tous ses magasins dès la première version. L'ancienne base n'est ni lue, ni convertie, ni effacée automatiquement. « Réinitialiser l'application » supprime la nouvelle et les anciennes. Les préférences et les clés restent dans le stockage local actuel.
- **Code retiré** : l'import de la v1, la reprise des anciennes clés, la reprise de l'ancien brief et des anciens réglages pour les projets antérieurs, le repli des anciens formats d'image, les restes de `textLayer` et le traitement des versions orphelines. Les champs d'un projet devenus toujours présents deviennent obligatoires.
- **Sauvegardes** : le format passe à une nouvelle version. Un zip d'une version antérieure est refusé, avant toute écriture, avec un message traduit. Un zip du format actuel n'ajoute que les miniatures absentes : celles déjà présentes restent telles quelles, car les fusionner pourrait créer un embranchement.
- **Module des versions** : on retire le calcul des branches et des embranchements. Restent la miniature et ses versions, les lignes de l'historique, le décompte des versions qu'un retour supprimerait, et s'ajoute la détection de la dernière version.
- **Agents** : `select_thumbnail` et les lectures restent possibles sur une ancienne version. `edit_thumbnail` y renvoie une erreur explicite. Aucun outil de retour ou de suppression n'est ajouté. La documentation du skill suit.
- **Travail précédent** : le commit des branches reste dans l'historique Git et cette version le remplace. La spec par branches sort de `docs/`, ses tickets sont fermés comme abandonnés, et les termes Branche et Embranchement sortent du glossaire.

## Testing Decisions

- **Ce qui fait un bon test** : il part d'une suite de versions et vérifie ce que le créateur obtient (quelles lignes, quelle version est ancienne, quelles versions disparaissent), avec des résultats écrits à la main.
- **Point de test 1, le module des versions**, déjà testé :
  - dernière version et version ancienne, y compris une miniature sans retouche ;
  - versions supprimées par un retour, y compris vers l'originale et vers la dernière ;
  - refus de créer une version depuis une version ancienne ;
  - groupes : minimum de deux, outils différents, exclusions, groupe déplié autour de la version affichée.
- **Point de test 2, la vérification du format de sauvegarde**, une fonction pure à extraire de l'import : format inconnu, version antérieure refusée, version actuelle acceptée.
- **Antériorité** : les tests actuels des versions.
- **Sans test automatique** : le projet n'a pas d'environnement DOM. Les boutons au survol, les confirmations et l'état « ancienne version » se vérifient dans l'app de test sur une miniature longue, puis dans l'app macOS (WebKit).

## Out of Scope

- La restauration après un retour en arrière.
- Tout embranchement, même caché.
- La conversion des données actuelles, et l'import d'anciens zips.
- La suppression d'une version seule.
- Un outil MCP de retour ou de suppression.
- La comparaison visuelle entre deux versions.
- Le nettoyage général du code hors des anciennes données et des branches.

## Further Notes

- **Choix par défaut à relire**, pris sans nouvelle question :
  - un favori posé sur une version retirée par un retour disparaît avec elle ;
  - une version sélectionnée pour le test et retirée quitte la sélection, sans se reporter sur la version vers laquelle on revient ;
  - l'export d'une ancienne version reste permis, sauf s'il demande un agrandissement ;
  - `edit_thumbnail` sur une ancienne version renvoie une erreur, sans viser la dernière en silence ;
  - l'ancienne base reste sur le disque jusqu'à une réinitialisation, ce qui rend le changement moins risqué.
- **Perte assumée** : après la mise à jour, projets, images, personnes et styles personnels n'apparaissent plus. Un zip exporté avant ne pourra pas être réimporté et sert d'archive de ses images seulement.
- **Risque** : deux boutons par-dessus une colonne de texte étroite peuvent masquer une bonne partie d'une instruction, à vérifier à l'usage.

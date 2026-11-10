# Glossaire

Le vocabulaire de Miniature Studio, à employer tel quel dans le code, les tickets et les specs. L'anglais entre parenthèses est le nom utilisé dans le code et l'interface anglaise.

## Le travail du créateur

**Projet** (project) : le travail autour d'une vidéo. Il garde son brief, ses références, sa chaîne, ses personnes choisies et ses réglages de sortie.

**Brief** : tout ce que le créateur remplit dans le panneau de gauche pour générer une image, surtout le titre de la vidéo, la scène et le style.

**Scène** (scene) : la description de ce que l'image doit montrer. C'est une partie du brief.
_À éviter : idée, description._

**Concept** : un angle de miniature proposé par l'assistant à partir du titre de la vidéo. Il remplit la scène et le style si le créateur le choisit.

## Les images

**Miniature** (thumbnail) : une image originale et la suite de ses versions. Une tuile de la bande du projet représente une miniature.
_À éviter : variante, quand il s'agit de l'ensemble._

**Version** : une image précise d'une miniature. Toute retouche, tout texte appliqué et tout recadrage crée une nouvelle version à la suite de la dernière, sans modifier la précédente.

**Originale** (original) : la première version d'une miniature, générée ou importée.

**Variante** (variant) : une des miniatures obtenues par une même génération, quand on en demande plusieurs.

**Historique** (history) : la suite des versions d'une miniature, de l'originale à la dernière, dans le panneau de droite.
_À éviter : versions, comme nom du panneau ; branche, qui n'existe pas dans ce modèle._

**Dernière version** (latest version) : la version sans suite. C'est la seule d'où peut partir une retouche.

**Ancienne version** (older version) : une version suivie d'au moins une autre. On peut l'afficher, mais pas la retoucher.

**Revenir à une version** (revert) : supprimer définitivement les versions plus récentes, pour que celle-ci redevienne la dernière.

**Dupliquer** (duplicate) : créer une nouvelle miniature indépendante, dont une version existante devient l'originale.

**Groupe** (group) : plusieurs étapes consécutives du même outil, réunies en une ligne dépliable de l'historique. Ce n'est qu'un affichage : chaque étape reste une version.

## La retouche

**Retouche** (edit) : une modification d'une version par le modèle, à partir d'une instruction.

**Instruction** : la phrase libre qui décrit une retouche.
_À éviter : prompt, qui désigne le texte complet envoyé au modèle._

**Retouche de zone** (region edit) : une retouche limitée à une zone peinte. Le reste de l'image est conservé au pixel près.

**Barre de retouche** (edit bar) : la barre flottante sous l'image. Elle réunit l'instruction, les outils, les suggestions, l'œil et l'envoi.
_À éviter : barre de prompt, barre d'outils._

**Poignée** (handle) : la partie de la barre de retouche qui sert à la déplacer.

**Outil** (tool) : un mode de travail sur l'image, un seul à la fois : Texte, Flèche, Zone ou Recadrer.

**Suggestion** : une instruction toute prête du menu de la barre de retouche. La choisir remplit le champ sans rien envoyer.

**Œil** (prompt eye) : l'aperçu, au survol, de ce qui serait envoyé au modèle.

## Ce qui oriente le modèle

**Prompt** : le texte complet envoyé à un modèle, écrit dans la langue de l'interface. Le créateur peut le voir avant l'envoi grâce à l'œil.

**Style** : une direction artistique réutilisable, préréglée ou créée par le créateur. Un style créé par le créateur reste dans la langue où il l'a écrit.

**Personne** (persona) : quelqu'un dont les photos servent à garder le visage fidèle. Les personnes forment une bibliothèque commune à tous les projets, et chaque projet en choisit au plus cinq.

**Référence** (reference) : une image jointe avec un rôle précis : composition, style, objet, décor ou usage libre.

**Gribouillis** (sketch view) : la vue où le créateur dessine la composition de sa miniature au pinceau noir sur une feuille blanche, puis génère à partir de ce dessin.

**Croquis** (sketch) : le dessin noir sur blanc de la vue Gribouillis, propre à chaque projet. Le modèle en suit la composition (placement, tailles, poses, cadrage), jamais le trait.

**Fournisseur** (provider) : le service qui exécute les modèles avec la clé du créateur : Replicate, Google Gemini, OpenRouter, Mammouth ou Vertex AI.

## Tester

**Aperçu du fil** (feed preview) : la miniature au milieu de vraies vidéos YouTube.

**Aperçu de la chaîne** (channel preview) : les miniatures du projet sur une page de chaîne YouTube.

**Zones de sécurité** (safe zones) : les parties de l'image que YouTube recouvre, comme la durée en bas à droite.

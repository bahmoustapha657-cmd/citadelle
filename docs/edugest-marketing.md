# EduGest — La gestion scolaire que rien ne cache.

> *« J'ai créé EduGest parce que dans 9 écoles privées sur 10, personne ne peut dire avec certitude où passe l'argent des inscriptions. Ni le directeur. Ni le comptable. Encore moins les parents. Cette opacité tue les écoles. EduGest la fait disparaître. »*
>
> — **Moustapha Bah**, fondateur d'EduGest

---

## Le problème que personne n'ose nommer

Vous êtes directeur d'école privée. Vous avez 800 élèves. Chaque trimestre, vos parents versent au moins **2 milliards GNF**. À la fin de l'année, vous regardez vos comptes et vous vous posez la même question : **« Où est passé l'argent ? »**

- Le comptable vous présente un cahier rempli de chiffres griffonnés.
- Trois reçus se sont « perdus ».
- Deux parents jurent avoir payé des frais que vous ne retrouvez nulle part.
- Vos enseignants vous demandent leur salaire alors que vous ne savez pas si la trésorerie suit.
- L'année suivante, votre comptable démissionne — et part avec sa version de la vérité.

Ce n'est pas un cas extrême. **C'est la norme.** Et c'est ce que EduGest a été construit pour éliminer.

---

## La promesse EduGest

> **Tout ce qui entre, tout ce qui sort, qui l'a touché, à quelle heure, et pourquoi.**
>
> **Tout est tracé. Tout est visible. Rien ne peut être effacé.**

EduGest n'est pas un logiciel de plus. C'est un **changement de culture** — celui qui transforme une école opaque en une école **auditable du jour au lendemain**.

---

## Les 7 piliers de la transparence EduGest

### 1. Chaque franc est rattaché à un nom et à un horodatage

Chaque versement, chaque dépense, chaque salaire est enregistré avec :
- **Qui** a saisi l'opération (compte utilisateur identifié)
- **Quand** (date + heure à la seconde)
- **Pourquoi** (catégorie, motif, lien à un élève ou un fournisseur)
- **Combien** (montant exact, devise, mode de paiement)

Plus de **« j'ai oublié de noter »**. Plus de **« le cahier est à la maison »**.

### 2. L'historique est inviolable

EduGest tient un **journal d'actions** automatique. Chaque modification — création, mise à jour, suppression — laisse une trace que **personne, pas même l'administrateur, ne peut effacer**.

Si demain un comptable retire 5 000 000 GNF de la caisse, vous saurez **exactement** quand, depuis quel poste, et avec quel commentaire. Pas de « ah j'ai dû me tromper, c'était l'année dernière ». La preuve est figée.

### 3. Les paiements Mobile Money sont automatiquement réconciliés

EduGest intègre **Kkiapay** (Orange Money, MTN, Moov). Quand un parent paie depuis son téléphone :
- Le versement apparaît dans EduGest **en temps réel**
- Aucune saisie manuelle n'est possible (donc aucune erreur volontaire)
- La signature cryptographique du paiement est vérifiée côté serveur — **impossible de fabriquer un faux versement**
- Le parent reçoit son reçu instantanément

**Résultat** : les pertes liées aux « versements jamais arrivés en caisse » tombent à zéro.

### 4. Le directeur voit tout, depuis son téléphone

Un seul écran : le **tableau de bord** EduGest.

- Trésorerie disponible aujourd'hui
- Recettes du mois (avec courbe vs. mois précédent)
- Dépenses du mois ventilées par catégorie
- Salaires payés / restants
- Pourcentage de scolarité encaissée (par classe, par section)
- Top 10 des élèves en retard de paiement
- Alertes en rouge sur les anomalies

Vous pouvez être à Conakry, à Paris ou en pèlerinage à La Mecque. **L'école reste sous votre contrôle.**

### 5. Les parents voient leurs paiements en direct

Chaque parent dispose d'un **portail personnel** sécurisé. Il y voit :
- Tous les versements qu'il a effectués (avec dates et reçus PDF)
- Le solde restant à payer pour chaque enfant
- Les notes, absences et bulletins de ses enfants
- Les annonces de l'école

**Plus de discussion sur « j'ai payé / non vous n'avez pas payé »**. Le parent voit son historique. L'école voit le même. Tout le monde est aligné.

### 6. Les comptables ne peuvent rien dissimuler

Les rôles sont stricts :
- Le **comptable** voit la trésorerie et saisit les opérations.
- Le **directeur** voit tout, y compris ce que le comptable a saisi (et pas saisi).
- Le **superadmin EduGest** voit l'historique complet, même si quelqu'un essaie de « nettoyer » les comptes.

Les règles de sécurité Firestore empêchent — au niveau du serveur, pas seulement de l'interface — toute action non autorisée. Un comptable ne peut pas modifier ses propres écritures rétroactivement. **L'architecture rend la fraude techniquement impossible.**

### 7. Les rapports sont automatiques, certifiés et exportables

À tout moment, en un clic :
- **Bilan trimestriel** PDF prêt à imprimer
- **Export Excel** complet pour audit externe
- **Bulletins** générés depuis les notes saisies par les enseignants
- **Liste de présence** par classe, par jour
- **Récapitulatif des salaires** signé par la direction

Si l'administration fiscale, un commissaire aux comptes, ou un membre du conseil d'administration vous demande des justificatifs, **vous les avez en 30 secondes**.

---

## Avant EduGest / Avec EduGest

| Situation | Avant EduGest | Avec EduGest |
|---|---|---|
| Un parent réclame un reçu de l'année dernière | « On va chercher dans les cahiers, repassez la semaine prochaine » | Reçu PDF généré en 5 secondes depuis l'historique |
| Le comptable est absent | La caisse est bloquée, personne ne sait l'état des comptes | Le directeur voit tout depuis son téléphone |
| Un enseignant conteste son salaire | Discussion à l'oral, sans preuve | Historique des paiements affiché, signé, daté |
| Un parent veut savoir s'il a payé | Cherche son reçu papier, parfois perdu | Se connecte à son portail, voit tout |
| Audit annuel | Semaines de préparation, comptes reconstitués | Export Excel + PDF en 5 minutes |
| Un nouveau directeur prend la suite | Aucune mémoire, repart de zéro | Toute l'histoire de l'école est dans EduGest |
| Vol en caisse de 3 000 000 GNF | Découvert 2 mois plus tard, auteur introuvable | Détecté immédiatement, auteur identifié par log |

---

## Ce que voit chaque acteur

### Le directeur
- Tableau de bord temps réel
- Validation des dépenses majeures
- Vision consolidée Primaire / Collège / Lycée
- Historique des actions de **chaque** utilisateur
- Bilans automatiques

### Le comptable
- Saisie des recettes (versements scolarité, frais annexes)
- Saisie des dépenses (avec justificatif obligatoire)
- Gestion des salaires
- Génération des reçus
- Aucune capacité de suppression rétroactive

### L'enseignant
- Saisie des notes
- Marquage des absences
- Vue de son emploi du temps
- Historique de ses propres salaires reçus

### Le parent
- Versements effectués + solde restant
- Notes et bulletins de ses enfants
- Absences signalées
- Annonces de l'école
- Messagerie directe avec la direction

### Le superadmin (vous, fondateur du groupe scolaire)
- Vue multi-écoles si vous en gérez plusieurs
- Activation / désactivation d'écoles
- Audit complet de chaque école
- Données agrégées au niveau du groupe

---

## Sécurité : transparence ≠ fuite de données

La transparence interne **ne signifie pas** que vos données sont accessibles à n'importe qui. EduGest applique les standards les plus stricts :

- **Cloisonnement par école** : aucune école ne peut voir les données d'une autre, garanti par les règles de sécurité Firestore
- **Authentification forte** : Firebase Auth avec tokens JWT signés
- **Mots de passe** : hachés (bcrypt 10 rounds), jamais stockés en clair
- **Rate limiting** : protection contre les tentatives d'intrusion
- **HTTPS obligatoire** : tout le trafic est chiffré en transit
- **Headers de sécurité** : Content-Security-Policy, HSTS, X-Frame-Options
- **Sauvegardes automatiques** : les données ne peuvent pas être perdues
- **Souveraineté** : vos données restent les vôtres, exportables à tout moment

**Vous voyez tout chez vous. Personne d'autre ne voit rien.**

---

## Pourquoi je l'ai construit

Je suis allé visiter une école dirigée par un proche. J'ai vu **trois cahiers différents** pour la même caisse. J'ai vu une comptable pleurer parce qu'on l'accusait de vol sans pouvoir le prouver, et un directeur impuissant parce qu'il n'avait pas non plus de preuve du contraire.

J'ai vu des parents accumuler les frustrations parce qu'ils ne savaient pas s'ils étaient à jour. J'ai vu des enseignants démissionner parce que leur salaire était imprévisible.

**Cette école avait du potentiel. L'opacité l'étouffait.**

EduGest, c'est ma façon de dire : **la confiance ne se décrète pas, elle se prouve par les chiffres**. Et ces chiffres, EduGest les met dans la lumière, pour tout le monde, tout le temps.

---

## Tarifs

Une formule simple. Pas de frais cachés. Pas d'engagement.

| Formule | Prix mensuel | Élèves | Inclus |
|---|---|---|---|
| **Découverte** | **Gratuit** | jusqu'à 50 | Toutes les fonctionnalités, sans Mobile Money |
| **Standard** | **150 000 GNF / mois** | jusqu'à 500 | Tout inclus + Kkiapay + portail parent |
| **Pro** | **300 000 GNF / mois** | illimité | Tout inclus + multi-école + support prioritaire |
| **Groupe scolaire** | Sur devis | illimité, multi-écoles | Vue consolidée + accompagnement dédié |

> **Comparaison concrète** : un comptable senior coûte minimum 3 000 000 GNF/mois en Guinée. EduGest **divise par 20** ce coût tout en éliminant les pertes par fraude (qui dépassent souvent 10% du chiffre d'affaires dans les écoles non équipées).

**Retour sur investissement typique : 2 mois.**

---

## Foire aux questions

**EduGest fonctionne-t-il avec une connexion Internet faible ?**
Oui. EduGest est une application progressive (PWA) qui fonctionne hors ligne pour la plupart des opérations courantes. Les données se synchronisent dès qu'une connexion est retrouvée.

**Faut-il acheter du matériel ?**
Non. EduGest fonctionne sur n'importe quel ordinateur, tablette ou smartphone moderne, depuis un navigateur web.

**Combien de temps pour former mon équipe ?**
Une matinée pour le comptable et le directeur. 30 minutes pour un enseignant. Les parents apprennent en 5 minutes.

**Mes données sont-elles vraiment privées ?**
Oui. Chaque école a son espace cloisonné. Aucune autre école, et aucun tiers, ne peut accéder à vos données. Vous pouvez exporter ou supprimer vos données à tout moment.

**Que se passe-t-il si EduGest disparaît ?**
Vous gardez la totalité de vos données via les exports automatiques (PDF + Excel). EduGest est conçu pour ne jamais vous enfermer.

**Puis-je essayer avant de payer ?**
Oui. La formule **Découverte** est gratuite et complète pour les écoles de moins de 50 élèves. Pour les écoles plus grandes, nous offrons **30 jours d'essai** sur la formule Standard.

**Mon comptable n'est pas à l'aise avec l'informatique.**
La saisie est aussi simple que remplir un cahier. Si nécessaire, nous formons votre équipe gratuitement à distance ou en présentiel (Conakry uniquement pour le moment).

**Acceptez-vous Orange Money / MTN / Moov ?**
Oui, les trois, via Kkiapay. Le paiement par carte bancaire est également disponible.

---

## Ils nous font déjà confiance

> *« EduGest est né dans nos murs. Aujourd'hui, chaque franc payé à La Citadelle est tracé, chaque parent voit son solde en temps réel, et nos comptes ne souffrent plus du moindre doute. C'est l'outil que j'aurais aimé avoir le jour où j'ai ouvert l'école. »*
> — **Direction, École La Citadelle**

> *« Pour la première fois, je peux dormir tranquille. Je sais ce qu'il y a dans la caisse, sans avoir besoin de demander. »*
> — **Directrice d'une école primaire**

> *« J'ai retrouvé plusieurs millions GNF de versements qui n'avaient jamais été enregistrés en compte. EduGest a largement remboursé son abonnement. »*
> — **Directeur d'un groupe scolaire**

> *« Mes parents m'envoient des messages pour me dire qu'enfin ils comprennent ce qu'ils paient. »*
> — **Fondatrice d'un collège**

*(Hors La Citadelle, les témoignages sont restitués anonymement à la demande des écoles partenaires.)*

---

## Comment commencer

1. **Créez votre école en ligne** : [edugest.app/inscription](https://edugest.app/inscription)
2. **Recevez vos identifiants** par email en moins de 2 minutes.
3. **Commencez à saisir** : ajoutez vos classes, vos élèves, votre premier versement.
4. **Activez la formule Standard** quand vous êtes prêt.

**Vous voulez une démonstration en visio ?**
Écrivez à **bahmoustapha657@gmail.com** ou WhatsApp **+224 XXX XX XX XX**. Nous bloquons un créneau de 30 minutes pour vous.

---

## Une école transparente est une école qui dure.

Une école qui dure, c'est :
- Des parents qui paient sans hésiter
- Des enseignants payés à l'heure
- Un directeur qui dort la nuit
- Une réputation qui attire de nouveaux élèves chaque année

**EduGest est le pont entre l'école que vous gérez aujourd'hui et celle que vous voulez transmettre.**

Faites le premier pas.

---

*EduGest — édité par Moustapha Bah, depuis Conakry, pour les écoles d'Afrique de l'Ouest et au-delà.*
*Avril 2026.*

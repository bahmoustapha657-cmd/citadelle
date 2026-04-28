# EduGest â€” La gestion scolaire que rien ne cache.

> *Â« J'ai crÃ©Ã© EduGest parce que dans 9 Ã©coles privÃ©es sur 10, personne ne peut dire avec certitude oÃ¹ passe l'argent des inscriptions. Ni le directeur. Ni le comptable. Encore moins les parents. Cette opacitÃ© tue les Ã©coles. EduGest la fait disparaÃ®tre. Â»*
>
> â€” **Moustapha Bah**, fondateur d'EduGest

---

## Le problÃ¨me que personne n'ose nommer

Vous Ãªtes directeur d'Ã©cole privÃ©e. Vous avez 800 Ã©lÃ¨ves. Chaque trimestre, vos parents versent au moins **2 milliards GNF**. Ã€ la fin de l'annÃ©e, vous regardez vos comptes et vous vous posez la mÃªme question : **Â« OÃ¹ est passÃ© l'argent ? Â»**

- Le comptable vous prÃ©sente un cahier rempli de chiffres griffonnÃ©s.
- Trois reÃ§us se sont Â« perdus Â».
- Deux parents jurent avoir payÃ© des frais que vous ne retrouvez nulle part.
- Vos enseignants vous demandent leur salaire alors que vous ne savez pas si la trÃ©sorerie suit.
- L'annÃ©e suivante, votre comptable dÃ©missionne â€” et part avec sa version de la vÃ©ritÃ©.

Ce n'est pas un cas extrÃªme. **C'est la norme.** Et c'est ce que EduGest a Ã©tÃ© construit pour Ã©liminer.

---

## La promesse EduGest

> **Tout ce qui entre, tout ce qui sort, qui l'a touchÃ©, Ã  quelle heure, et pourquoi.**
>
> **Tout est tracÃ©. Tout est visible. Rien ne peut Ãªtre effacÃ©.**

EduGest n'est pas un logiciel de plus. C'est un **changement de culture** â€” celui qui transforme une Ã©cole opaque en une Ã©cole **auditable du jour au lendemain**.

---

## Les 7 piliers de la transparence EduGest

### 1. Chaque franc est rattachÃ© Ã  un nom et Ã  un horodatage

Chaque versement, chaque dÃ©pense, chaque salaire est enregistrÃ© avec :
- **Qui** a saisi l'opÃ©ration (compte utilisateur identifiÃ©)
- **Quand** (date + heure Ã  la seconde)
- **Pourquoi** (catÃ©gorie, motif, lien Ã  un Ã©lÃ¨ve ou un fournisseur)
- **Combien** (montant exact, devise, mode de paiement)

Plus de **Â« j'ai oubliÃ© de noter Â»**. Plus de **Â« le cahier est Ã  la maison Â»**.

### 2. L'historique est inviolable

EduGest tient un **journal d'actions** automatique. Chaque modification â€” crÃ©ation, mise Ã  jour, suppression â€” laisse une trace que **personne, pas mÃªme l'administrateur, ne peut effacer**.

Si demain un comptable retire 5 000 000 GNF de la caisse, vous saurez **exactement** quand, depuis quel poste, et avec quel commentaire. Pas de Â« ah j'ai dÃ» me tromper, c'Ã©tait l'annÃ©e derniÃ¨re Â». La preuve est figÃ©e.

### 3. Les paiements Mobile Money sont automatiquement rÃ©conciliÃ©s

EduGest intÃ¨gre **paiement Mobile Money** (Orange Money, MTN, Moov). Quand un parent paie depuis son tÃ©lÃ©phone :
- Le versement apparaÃ®t dans EduGest **en temps rÃ©el**
- Aucune saisie manuelle n'est possible (donc aucune erreur volontaire)
- La signature cryptographique du paiement est vÃ©rifiÃ©e cÃ´tÃ© serveur â€” **impossible de fabriquer un faux versement**
- Le parent reÃ§oit son reÃ§u instantanÃ©ment

**RÃ©sultat** : les pertes liÃ©es aux Â« versements jamais arrivÃ©s en caisse Â» tombent Ã  zÃ©ro.

### 4. Le directeur voit tout, depuis son tÃ©lÃ©phone

Un seul Ã©cran : le **tableau de bord** EduGest.

- TrÃ©sorerie disponible aujourd'hui
- Recettes du mois (avec courbe vs. mois prÃ©cÃ©dent)
- DÃ©penses du mois ventilÃ©es par catÃ©gorie
- Salaires payÃ©s / restants
- Pourcentage de scolaritÃ© encaissÃ©e (par classe, par section)
- Top 10 des Ã©lÃ¨ves en retard de paiement
- Alertes en rouge sur les anomalies

Vous pouvez Ãªtre Ã  Conakry, Ã  Paris ou en pÃ¨lerinage Ã  La Mecque. **L'Ã©cole reste sous votre contrÃ´le.**

### 5. Les parents voient leurs paiements en direct

Chaque parent dispose d'un **portail personnel** sÃ©curisÃ©. Il y voit :
- Tous les versements qu'il a effectuÃ©s (avec dates et reÃ§us PDF)
- Le solde restant Ã  payer pour chaque enfant
- Les notes, absences et bulletins de ses enfants
- Les annonces de l'Ã©cole

**Plus de discussion sur Â« j'ai payÃ© / non vous n'avez pas payÃ© Â»**. Le parent voit son historique. L'Ã©cole voit le mÃªme. Tout le monde est alignÃ©.

### 6. Les comptables ne peuvent rien dissimuler

Les rÃ´les sont stricts :
- Le **comptable** voit la trÃ©sorerie et saisit les opÃ©rations.
- Le **directeur** voit tout, y compris ce que le comptable a saisi (et pas saisi).
- Le **superadmin EduGest** voit l'historique complet, mÃªme si quelqu'un essaie de Â« nettoyer Â» les comptes.

Les rÃ¨gles de sÃ©curitÃ© Firestore empÃªchent â€” au niveau du serveur, pas seulement de l'interface â€” toute action non autorisÃ©e. Un comptable ne peut pas modifier ses propres Ã©critures rÃ©troactivement. **L'architecture rend la fraude techniquement impossible.**

### 7. Les rapports sont automatiques, certifiÃ©s et exportables

Ã€ tout moment, en un clic :
- **Bilan trimestriel** PDF prÃªt Ã  imprimer
- **Export Excel** complet pour audit externe
- **Bulletins** gÃ©nÃ©rÃ©s depuis les notes saisies par les enseignants
- **Liste de prÃ©sence** par classe, par jour
- **RÃ©capitulatif des salaires** signÃ© par la direction

Si l'administration fiscale, un commissaire aux comptes, ou un membre du conseil d'administration vous demande des justificatifs, **vous les avez en 30 secondes**.

---

## Avant EduGest / Avec EduGest

| Situation | Avant EduGest | Avec EduGest |
|---|---|---|
| Un parent rÃ©clame un reÃ§u de l'annÃ©e derniÃ¨re | Â« On va chercher dans les cahiers, repassez la semaine prochaine Â» | ReÃ§u PDF gÃ©nÃ©rÃ© en 5 secondes depuis l'historique |
| Le comptable est absent | La caisse est bloquÃ©e, personne ne sait l'Ã©tat des comptes | Le directeur voit tout depuis son tÃ©lÃ©phone |
| Un enseignant conteste son salaire | Discussion Ã  l'oral, sans preuve | Historique des paiements affichÃ©, signÃ©, datÃ© |
| Un parent veut savoir s'il a payÃ© | Cherche son reÃ§u papier, parfois perdu | Se connecte Ã  son portail, voit tout |
| Audit annuel | Semaines de prÃ©paration, comptes reconstituÃ©s | Export Excel + PDF en 5 minutes |
| Un nouveau directeur prend la suite | Aucune mÃ©moire, repart de zÃ©ro | Toute l'histoire de l'Ã©cole est dans EduGest |
| Vol en caisse de 3 000 000 GNF | DÃ©couvert 2 mois plus tard, auteur introuvable | DÃ©tectÃ© immÃ©diatement, auteur identifiÃ© par log |

---

## Ce que voit chaque acteur

### Le directeur
- Tableau de bord temps rÃ©el
- Validation des dÃ©penses majeures
- Vision consolidÃ©e Primaire / CollÃ¨ge / LycÃ©e
- Historique des actions de **chaque** utilisateur
- Bilans automatiques

### Le comptable
- Saisie des recettes (versements scolaritÃ©, frais annexes)
- Saisie des dÃ©penses (avec justificatif obligatoire)
- Gestion des salaires
- GÃ©nÃ©ration des reÃ§us
- Aucune capacitÃ© de suppression rÃ©troactive

### L'enseignant
- Saisie des notes
- Marquage des absences
- Vue de son emploi du temps
- Historique de ses propres salaires reÃ§us

### Le parent
- Versements effectuÃ©s + solde restant
- Notes et bulletins de ses enfants
- Absences signalÃ©es
- Annonces de l'Ã©cole
- Messagerie directe avec la direction

### Le superadmin (vous, fondateur du groupe scolaire)
- Vue multi-Ã©coles si vous en gÃ©rez plusieurs
- Activation / dÃ©sactivation d'Ã©coles
- Audit complet de chaque Ã©cole
- DonnÃ©es agrÃ©gÃ©es au niveau du groupe

---

## SÃ©curitÃ© : transparence â‰  fuite de donnÃ©es

La transparence interne **ne signifie pas** que vos donnÃ©es sont accessibles Ã  n'importe qui. EduGest applique les standards les plus stricts :

- **Cloisonnement par Ã©cole** : aucune Ã©cole ne peut voir les donnÃ©es d'une autre, garanti par les rÃ¨gles de sÃ©curitÃ© Firestore
- **Authentification forte** : Firebase Auth avec tokens JWT signÃ©s
- **Mots de passe** : hachÃ©s (bcrypt 10 rounds), jamais stockÃ©s en clair
- **Rate limiting** : protection contre les tentatives d'intrusion
- **HTTPS obligatoire** : tout le trafic est chiffrÃ© en transit
- **Headers de sÃ©curitÃ©** : Content-Security-Policy, HSTS, X-Frame-Options
- **Sauvegardes automatiques** : les donnÃ©es ne peuvent pas Ãªtre perdues
- **SouverainetÃ©** : vos donnÃ©es restent les vÃ´tres, exportables Ã  tout moment

**Vous voyez tout chez vous. Personne d'autre ne voit rien.**

---

## Pourquoi je l'ai construit

Je suis allÃ© visiter une Ã©cole dirigÃ©e par un proche. J'ai vu **trois cahiers diffÃ©rents** pour la mÃªme caisse. J'ai vu une comptable pleurer parce qu'on l'accusait de vol sans pouvoir le prouver, et un directeur impuissant parce qu'il n'avait pas non plus de preuve du contraire.

J'ai vu des parents accumuler les frustrations parce qu'ils ne savaient pas s'ils Ã©taient Ã  jour. J'ai vu des enseignants dÃ©missionner parce que leur salaire Ã©tait imprÃ©visible.

**Cette Ã©cole avait du potentiel. L'opacitÃ© l'Ã©touffait.**

EduGest, c'est ma faÃ§on de dire : **la confiance ne se dÃ©crÃ¨te pas, elle se prouve par les chiffres**. Et ces chiffres, EduGest les met dans la lumiÃ¨re, pour tout le monde, tout le temps.

---

## Tarifs

Une formule simple. Pas de frais cachÃ©s. Pas d'engagement.

| Formule | Prix mensuel | Ã‰lÃ¨ves | Inclus |
|---|---|---|---|
| **DÃ©couverte** | **Gratuit** | jusqu'Ã  50 | Toutes les fonctionnalitÃ©s, sans Mobile Money |
| **Standard** | **150 000 GNF / mois** | jusqu'Ã  500 | Tout inclus + paiement Mobile Money + portail parent |
| **Pro** | **300 000 GNF / mois** | illimitÃ© | Tout inclus + multi-Ã©cole + support prioritaire |
| **Groupe scolaire** | Sur devis | illimitÃ©, multi-Ã©coles | Vue consolidÃ©e + accompagnement dÃ©diÃ© |

> **Comparaison concrÃ¨te** : un comptable senior coÃ»te minimum 3 000 000 GNF/mois en GuinÃ©e. EduGest **divise par 20** ce coÃ»t tout en Ã©liminant les pertes par fraude (qui dÃ©passent souvent 10% du chiffre d'affaires dans les Ã©coles non Ã©quipÃ©es).

**Retour sur investissement typique : 2 mois.**

---

## Foire aux questions

**EduGest fonctionne-t-il avec une connexion Internet faible ?**
Oui. EduGest est une application progressive (PWA) qui fonctionne hors ligne pour la plupart des opÃ©rations courantes. Les donnÃ©es se synchronisent dÃ¨s qu'une connexion est retrouvÃ©e.

**Faut-il acheter du matÃ©riel ?**
Non. EduGest fonctionne sur n'importe quel ordinateur, tablette ou smartphone moderne, depuis un navigateur web.

**Combien de temps pour former mon Ã©quipe ?**
Une matinÃ©e pour le comptable et le directeur. 30 minutes pour un enseignant. Les parents apprennent en 5 minutes.

**Mes donnÃ©es sont-elles vraiment privÃ©es ?**
Oui. Chaque Ã©cole a son espace cloisonnÃ©. Aucune autre Ã©cole, et aucun tiers, ne peut accÃ©der Ã  vos donnÃ©es. Vous pouvez exporter ou supprimer vos donnÃ©es Ã  tout moment.

**Que se passe-t-il si EduGest disparaÃ®t ?**
Vous gardez la totalitÃ© de vos donnÃ©es via les exports automatiques (PDF + Excel). EduGest est conÃ§u pour ne jamais vous enfermer.

**Puis-je essayer avant de payer ?**
Oui. La formule **DÃ©couverte** est gratuite et complÃ¨te pour les Ã©coles de moins de 50 Ã©lÃ¨ves. Pour les Ã©coles plus grandes, nous offrons **30 jours d'essai** sur la formule Standard.

**Mon comptable n'est pas Ã  l'aise avec l'informatique.**
La saisie est aussi simple que remplir un cahier. Si nÃ©cessaire, nous formons votre Ã©quipe gratuitement Ã  distance ou en prÃ©sentiel (Conakry uniquement pour le moment).

**Acceptez-vous Orange Money / MTN / Moov ?**
Oui, les trois, en suivi Mobile Money. Le paiement par carte bancaire est Ã©galement disponible.

---

## Ils nous font dÃ©jÃ  confiance

> *Â« EduGest est nÃ© dans nos murs. Aujourd'hui, chaque franc payÃ© Ã  La Citadelle est tracÃ©, chaque parent voit son solde en temps rÃ©el, et nos comptes ne souffrent plus du moindre doute. C'est l'outil que j'aurais aimÃ© avoir le jour oÃ¹ j'ai ouvert l'Ã©cole. Â»*
> â€” **Direction, Ã‰cole La Citadelle**

> *Â« Pour la premiÃ¨re fois, je peux dormir tranquille. Je sais ce qu'il y a dans la caisse, sans avoir besoin de demander. Â»*
> â€” **Directrice d'une Ã©cole primaire**

> *Â« J'ai retrouvÃ© plusieurs millions GNF de versements qui n'avaient jamais Ã©tÃ© enregistrÃ©s en compte. EduGest a largement remboursÃ© son abonnement. Â»*
> â€” **Directeur d'un groupe scolaire**

> *Â« Mes parents m'envoient des messages pour me dire qu'enfin ils comprennent ce qu'ils paient. Â»*
> â€” **Fondatrice d'un collÃ¨ge**

*(Hors La Citadelle, les tÃ©moignages sont restituÃ©s anonymement Ã  la demande des Ã©coles partenaires.)*

---

## Comment commencer

1. **CrÃ©ez votre Ã©cole en ligne** : [edugest.app/inscription](https://edugest.app/inscription)
2. **Recevez vos identifiants** par email en moins de 2 minutes.
3. **Commencez Ã  saisir** : ajoutez vos classes, vos Ã©lÃ¨ves, votre premier versement.
4. **Activez la formule Standard** quand vous Ãªtes prÃªt.

**Vous voulez une dÃ©monstration en visio ?**
Ã‰crivez Ã  **bahmoustapha657@gmail.com** ou WhatsApp **+224 XXX XX XX XX**. Nous bloquons un crÃ©neau de 30 minutes pour vous.

---

## Une Ã©cole transparente est une Ã©cole qui dure.

Une Ã©cole qui dure, c'est :
- Des parents qui paient sans hÃ©siter
- Des enseignants payÃ©s Ã  l'heure
- Un directeur qui dort la nuit
- Une rÃ©putation qui attire de nouveaux Ã©lÃ¨ves chaque annÃ©e

**EduGest est le pont entre l'Ã©cole que vous gÃ©rez aujourd'hui et celle que vous voulez transmettre.**

Faites le premier pas.

---

*EduGest â€” Ã©ditÃ© par Moustapha Bah, depuis Conakry, pour les Ã©coles d'Afrique de l'Ouest et au-delÃ .*
*Avril 2026.*


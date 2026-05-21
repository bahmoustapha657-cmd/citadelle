# Manuel d'utilisation — EduGest

Guide complet pour les écoles utilisant **EduGest** (toutes versions de plan). Couvre tous les rôles, écran par écran.

> Pour les questions d'installation, de facturation ou de migration de données, contactez votre Super-Admin.

---

## Table des matières

1. [Présentation & concepts](#1-présentation--concepts)
2. [Connexion & première mise en route](#2-connexion--première-mise-en-route)
3. [Interface générale](#3-interface-générale)
4. [Tableau de bord (Accueil)](#4-tableau-de-bord-accueil)
5. [Paramètres de l'école](#5-paramètres-de-lécole)
6. [Section Primaire / Secondaire](#6-section-primaire--secondaire)
7. [Module Comptabilité](#7-module-comptabilité)
8. [Fondation](#8-fondation)
9. [Calendrier](#9-calendrier)
10. [Gestion des examens](#10-gestion-des-examens)
11. [Messagerie](#11-messagerie)
12. [Panneau Admin (mots de passe, promotion)](#12-panneau-admin-mots-de-passe-promotion)
13. [Historique des actions](#13-historique-des-actions)
14. [Portail Enseignant](#14-portail-enseignant)
15. [Portail Parent](#15-portail-parent)
16. [Recherche globale & raccourcis](#16-recherche-globale--raccourcis)
17. [Conformité légale & archives](#17-conformité-légale--archives)
18. [FAQ & dépannage](#18-faq--dépannage)

---

## 1. Présentation & concepts

### 1.1 Qu'est-ce qu'EduGest ?

EduGest est une plateforme SaaS multi-tenant de gestion d'établissement scolaire. Chaque école a son propre espace isolé (`/ecoles/{schoolId}`), avec ses utilisateurs, élèves, notes, paiements et paramètres. Une école peut gérer simultanément Primaire, Collège, Lycée, ainsi qu'une Fondation associée.

### 1.2 Les rôles

| Rôle | Qui ? | Ce qu'il peut faire |
|---|---|---|
| **Direction (DG)** | Le directeur général | Accès total à tous les modules. Pilote, paramètre, ferme l'école. |
| **Admin** | Bras droit du DG | Accès délégué par le DG, **module par module**, en lecture seule ou écriture. |
| **Comptable** | Personne en charge des finances | Module Comptabilité (recettes, dépenses, salaires, élèves, mensualités). Peut créer des comptes parents. |
| **Primaire / Collège / Lycée** | Personnel de section | Accès à leur section uniquement (élèves, notes, bulletins). |
| **Enseignant** | Professeur titulaire | Portail dédié : notes, EDT, absences, salaire. |
| **Parent** | Parent d'élève | Portail dédié : notes de ses enfants, absences, bulletins, paiements, messagerie. |
| **Super-Admin** | Éditeur EduGest | Gestion des écoles clientes (hors scope école). |

Chaque rôle a un mot de passe individuel ; un même utilisateur peut être lié à plusieurs élèves (parent) ou à plusieurs sections (admin polyvalent).

### 1.3 Les plans

EduGest propose plusieurs plans (visibles dans `Paramètres → Officiel`) :

- **Découverte** — version d'essai limitée
- **Standard** — gestion complète d'une section
- **Pro** — multi-sections, modules avancés (bulletins personnalisés, EDT, etc.)
- **Premium** — fonctions étendues (rapports, exports, fondation)

Si vous atteignez un quota (ex: nombre d'élèves), une **modale de mise à niveau** s'ouvre automatiquement avec les contacts paiement de l'éditeur.

### 1.4 Périodicité scolaire

L'école choisit dans `Paramètres → Évaluations` la périodicité :
- **Trimestrielle** (3 trimestres) — réglage par défaut, primaire le plus souvent
- **Semestrielle** (2 semestres) — collège/lycée fréquemment
- **Mensuelle** — écoles spécifiques

La périodicité peut différer entre Primaire et Secondaire dans la même école.

### 1.5 Archive multi-années

Toutes les données métier (élèves, notes, paiements, salaires, etc.) sont datées de l'année scolaire. Le sélecteur **« Année consultée »** présent dans Comptabilité et la section École permet de revenir sur n'importe quelle année passée en lecture seule. L'année active (saisie) est définie dans `Panneau Admin → Année scolaire`.

### 1.6 Langues

EduGest est disponible en **Français / Anglais / Arabe** (avec support RTL automatique). Changement via le menu profil → 🌐.

---

## 2. Connexion & première mise en route

### 2.1 Première connexion

1. Le Super-Admin a créé votre école avec un compte **Direction** initial.
2. Rendez-vous sur l'URL EduGest fournie (ex : `https://edugest-gn.vercel.app`).
3. Cliquez sur **Connexion**, choisissez le rôle **Direction**, entrez votre identifiant et mot de passe initial.
4. À la première connexion, EduGest vous demande de **changer votre mot de passe** (modale automatique).

### 2.2 Guide de démarrage (DG/Admin)

Une fois connecté en tant que DG ou Admin, un bouton flottant **🚀** apparaît en bas à gauche. Il ouvre un guide en 6 étapes :

1. Configurer l'identité de l'école (nom, logo, couleurs, coordonnées)
2. Créer les classes (Primaire / Secondaire)
3. Ajouter les enseignants (profil, matière, prime horaire)
4. Enrôler les élèves (via Comptabilité → Élèves)
5. Configurer les emplois du temps
6. Générer les états de salaires

Chaque étape est cliquable et vous amène directement à l'écran concerné.

### 2.3 Création des comptes utilisateurs

Le DG et l'Admin créent les autres comptes depuis `Panneau Admin`. Le Comptable peut, depuis sa propre interface, **créer les comptes parents** (utile pour onboarder rapidement les familles).

---

## 3. Interface générale

### 3.1 Sidebar (menu principal)

À gauche de l'écran, le menu liste les pages accessibles selon votre rôle :

- 🏠 **Accueil** (Tableau de bord)
- 📚 **Primaire** *(selon profil de l'école)*
- 🎓 **Secondaire / Collège / Lycée**
- 💰 **Comptabilité**
- 🏛 **Fondation** *(si activée)*
- 📅 **Calendrier**
- 📝 **Examens**
- 💬 **Messages parents**
- 🛡 **Panneau Admin**
- 🗂 **Historique**
- ⚙️ **Paramètres** *(via menu profil)*

Sur mobile, la sidebar se replie en hamburger.

### 3.2 Header (barre du haut)

De gauche à droite :

- **🔍 Recherche globale** (raccourci `Ctrl+K`) — trouve un élève, un enseignant, un parent, ou navigue vers un module
- **Année scolaire active** — chip indiquant l'année en cours de saisie
- **🔔 Notifications** — 10 dernières actions, badge rouge si actions < 5 min
- **Avatar + menu profil** — accès à Paramètres, Raccourcis, Langue, Déconnexion

### 3.3 Indicateurs visuels

- **Badge couleur du rôle** : admin = mauve, comptable = sarcelle, direction = bleu
- **Bandeau orange** « lecture seule » : l'année consultée ≠ année active, ou votre rôle n'a que la lecture
- **Bandeau rouge** « Action requise » : conformité légale incomplète, paiement à valider, etc.

---

## 4. Tableau de bord (Accueil)

L'écran d'accueil affiche des **statistiques temps réel** :

- **Cartes KPI** : nombre d'élèves actifs (par section), enseignants, recettes du mois, dépenses du mois, taux de paiement
- **Graphique évolution** : recettes vs dépenses sur les 12 derniers mois
- **Top 5 classes** : effectif, moyenne générale
- **Alertes** :
  - Conformité légale incomplète → cliquer ouvre `Paramètres → Officiel`
  - Mensualités impayées du mois > seuil → cliquer ouvre `Comptabilité → Mensualités`
  - Plan expirant dans < 7 jours → ouvre la modale de mise à niveau
- **Widget « Compte à rebours »** : agrément officiel arrivant à échéance (cf. § Conformité)

Les KPI sont liés au sélecteur d'année. Changer d'année recalcule tout.

---

## 5. Paramètres de l'école

Accès : menu profil → **🏫 Paramètres école**. Réservé à Direction / Admin / Comptable / Super-Admin.

### 5.1 Onglet « Identité »

- **Nom de l'école**, **slogan**, **logo** (upload PNG/JPG)
- **Couleur principale** + **couleur secondaire** (sélecteur HEX) — appliqué automatiquement à toute l'interface et aux PDF
- **Coordonnées** : adresse, téléphone, email, site web
- **Sections actives** : cocher *Primaire*, *Collège*, *Lycée*, *Fondation* (active/désactive les menus correspondants)

### 5.2 Onglet « Accueil »

- **Photo de couverture** du portail public
- **Message de bienvenue** (visible sur la page d'accueil du portail externe)
- **Activation du portail public** (sans connexion) : on/off

### 5.3 Onglet « Officiel » — Conformité légale

Données stockées dans `/ecoles/{id}/config/legal` :
- **Promoteur** : nom, année et lieu de naissance
- **Autorisation de création** : numéro d'arrêté, date, autorité émettrice
- **Agrément** : numéro, date, **date d'expiration** (déclenche le compte à rebours sur le tableau de bord)
- **Codes statistiques** : code MEN, code commune, code circonscription
- **Cycles enseignés** (maternelle, primaire, secondaire)
- **Personnes ressources** : directeur, fondateur, secrétariat

Ces données apparaissent dans le **footer des bulletins, attestations et PDF officiels**.

### 5.4 Onglet « Évaluations »

- **Périodicité** : trimestre / semestre / mensuel (réglable par section)
- **Types d'évaluation** : Devoir, Composition, Interrogation, etc. — créer, renommer, désactiver
- **Coefficients de calcul** : pondération des notes pour la moyenne périodique
- **Note maximale** : généralement 20 (secondaire), 10 (primaire)
- **Mention** : seuils pour Passable / Bien / Très Bien / Excellent

### 5.5 Onglet « Matricules »

- **Format** : préfixe + numéro (ex: `EDU-2025-0001`)
- **Compteur courant** : redémarrer si nécessaire
- **Largeur du numéro** : padding sur N chiffres
- **Application automatique** : nouveau matricule à chaque enrôlement

### 5.6 Onglet « Affichage »

- **Labels personnalisés** : renommer « Direction » en « DG », « Comptable » en « Caissier », etc. — utile pour adapter au vocabulaire local
- **Devise** : FCFA, EUR, USD, MAD, etc. (impacte tous les affichages monétaires et PDF)

### 5.7 Onglet « ⚠ Danger » (DG uniquement)

- **Fermer l'école** (cycle de vie) : passe en mode archive lecture seule
- **Réinitialiser une année** : supprime toutes les données d'une année scolaire (irréversible, double confirmation)
- **Supprimer définitivement l'école** : action finale, requiert le mot de passe DG + une phrase de confirmation

---

## 6. Section Primaire / Secondaire

Page accessible depuis la sidebar (`📚 Primaire`, `🎓 Collège`, `🎓 Lycée`). Chaque section a la même structure, avec 12 onglets.

### 6.1 Onglet « Aperçu »

Vue d'ensemble de la section :
- Nombre de classes, élèves, enseignants
- Moyenne générale, taux de réussite
- Top élèves de la période
- Liens rapides vers les autres onglets

### 6.2 Onglet « Classes »

- **Créer une classe** : nom (CP, CE1, 6ème A…), niveau, capacité, salle, titulaire
- **Éditer / supprimer** : double clic ou icône ✏️
- **Couleur** : assigner une couleur d'affichage à la classe
- **Réordonner** : drag-and-drop dans la liste

### 6.3 Onglet « Élèves »

- **Tableau sticky** : matricule, nom, prénom, classe, sexe, date naissance, parents, statut, actions
- **Recherche/filtres** : par classe, statut (actif, transféré, sorti), genre
- **Ajouter un élève** :
  1. Informations civiles (matricule auto, nom, prénom, date/lieu de naissance, genre, nationalité)
  2. Affectation classe
  3. Parents (lier comptes existants ou créer)
  4. Photo
- **Actions ligne** : voir détail, modifier, transférer de classe, marquer sorti, supprimer
- **Imports/exports** : CSV ou Excel (selon plan)

### 6.4 Onglet « Enseignants » (Ens)

- **Liste** : nom, matière, classes assignées, prime horaire, mobile, statut
- **Ajouter** :
  - Identité, matière(s), photo
  - **Prime horaire** (utilisée par la paie)
  - **Classes assignées**
  - Création automatique d'un **compte enseignant** + envoi des identifiants
- **Disponibilité** : créneaux non disponibles (pour l'EDT)

### 6.5 Onglet « Notes »

- **Filtres** : classe, matière, période, type d'évaluation
- **Saisie par élève** : ouvrir la fiche élève, ajouter une note (matière, type, valeur, date)
- **Saisie en grille** : tableau classe × élèves, remplir toute la classe en une page
- **Validation** : si la note dépasse la note max, alerte rouge
- **Génération automatique des moyennes** : périodique et annuelle, en bas de tableau

### 6.6 Onglet « Enseignements » (cours effectués)

- **Calendrier des séances** : classe, matière, enseignant, date, statut (Effectué / Absent / Non effectué)
- **Saisie comptable** : utile pour la paie au taux horaire
- **Motif** : champ libre si absence

### 6.7 Onglet « Discipline »

- **Incidents** : absence, retard, indiscipline, avertissement, sanction, renvoi temporaire
- **Saisie** : élève, date, type, justifié (oui/non), motif
- **Filtres** : par classe, type, période
- **Imprimer** : convocation parents, registre disciplinaire

### 6.8 Onglet « Bulletins »

- **Génération** : choisir classe → période → générer tous les bulletins en PDF
- **Aperçu** : prévisualisation avant impression
- **Personnalisation** (plan Pro+) : modèle, ordre des matières, appréciations automatiques
- **Téléchargement** : individuel ou ZIP de toute la classe
- **Le footer du bulletin** intègre les informations légales (cf. § Conformité)

### 6.9 Onglet « Livrets » (livret scolaire annuel)

- Récapitulatif des notes sur l'année entière (toutes périodes)
- Décisions de conseil de classe : passage, redoublement, exclusion
- Imprimable en fin d'année

### 6.10 Onglet « Matières »

- **Liste** : nom, abréviation, coefficient, section, ordre
- **Ajouter/modifier** une matière (Mathématiques, Français, Anglais…)
- **Coefficient** : poids dans la moyenne (ex: Math coef 4)

### 6.11 Onglet « Emploi du temps » (EDT)

*(Section avec enseignants uniquement)*
- **Grille hebdomadaire** : lundi → samedi/dimanche, créneaux horaires
- **Glisser-déposer** : placer une matière dans un créneau (enseignant proposé selon affectations)
- **Conflit détecté** : enseignant déjà occupé → alerte rouge
- **Impression** : EDT classe ou EDT enseignant

### 6.12 Onglet « Attestations »

- Génération : attestation de scolarité, attestation de fréquentation, certificat de transfert
- Choix de l'élève → période → impression PDF avec en-tête et footer légal

---

## 7. Module Comptabilité

Accès : sidebar `💰 Comptabilité`. 10 onglets.

### 7.1 Onglet « Bilan »

- **KPI mensuels** : recettes, dépenses, solde, taux de recouvrement
- **Graphique 12 mois** : courbes recettes/dépenses
- **Top postes de dépenses**
- **Alertes** : déficit, paiements en retard

### 7.2 Onglet « Recettes »

- **Saisie d'une recette** : date, montant, libellé, catégorie, mode (espèces / virement / mobile money), bénéficiaire (école / fondation)
- **Lien à un élève** : pour les paiements de mensualités, frais annexes, inscription
- **Reçu** : génération PDF automatique avec numéro de reçu unique
- **Filtres** : période, catégorie, mode, élève
- **Export Excel** (selon plan)

### 7.3 Onglet « Dépenses »

- Mêmes mécanismes que les recettes, côté sortie
- **Catégories typiques** : Fournitures, Énergie, Eau, Loyer, Salaires (transitent par l'onglet Salaires), Maintenance, Transports
- **Justificatif** : champ upload (PDF/image)

### 7.4 Onglet « Salaires »

L'onglet le plus dense de la compta. Trois sections : **Primaire**, **Secondaire**, **Personnel**.

- **Générer les salaires d'un mois** : bouton `Auto-générer` calcule, pour chaque enseignant, son salaire mois = (heures effectuées × prime horaire) + frais annexes − retenues
- **Frais annexes** : prime de déplacement, prime de soir, etc. (toggle par enseignant)
- **Bons** : avances ou retenues sur salaire — sélecteur de bénéficiaire qui exclut désormais les enseignants supprimés ou renommés
- **Tableau** : matricule, nom, total heures, salaire de base, frais annexes, bons, net à payer, payé (oui/non)
- **Marquer payé** : enregistre la dépense automatiquement
- **Imprimer fiches de paie** : individuelles ou batch (ZIP PDF)

### 7.5 Onglet « Enseignants » (vue comptable)

Vue comptable des enseignants :
- Historique mensuel des salaires
- Bons accordés (avances) et soldes
- Cumul annuel

### 7.6 Onglet « Personnel » (non-enseignant)

- Personnel administratif, gardien, cuisine, chauffeur, etc.
- Gestion analogue aux enseignants mais salaire **forfaitaire** (et non par heure)

### 7.7 Onglet « Fondation »

Compta dédiée à la fondation (si activée) :
- Recettes (dons, subventions)
- Dépenses (projets, bourses)
- Cloisonnée de la compta école

### 7.8 Onglet « Enrôlement »

- **Vue d'ensemble** des élèves de l'année : statut d'inscription, frais d'inscription payés, dossier complet
- **Suivi** des dossiers incomplets (papiers manquants)
- **Bouton** : marquer un dossier complet, encaisser frais d'inscription

### 7.9 Onglet « Mensualités »

L'onglet le plus consulté par le comptable.

- **Tableau sticky** (en-tête fixe, 2 colonnes gauches fixes) : élève × mois de l'année
- **Cellule** : verte (payé), rouge (impayé), grise (non dû — élève pas encore inscrit ce mois-là)
- **Cliquer une cellule** : ouvre une modale avec montant, date, mode de paiement → marque payé
- **Cliquer le mois (colonne)** : encaisser tout le mois pour la classe
- **Filtres** : classe, statut (à jour / en retard), genre

### 7.10 Onglet « Transferts »

- Transferts inter-écoles (si le groupe a plusieurs entités)
- Mouvements de fonds école ↔ fondation
- Lien rapide vers Enrôlement quand un élève est reçu en transfert

---

## 8. Fondation

*(Si activée dans Paramètres → Identité)*

Page autonome dédiée à la gestion d'une fondation associée à l'école : projets, bénévoles, donateurs, bourses, dépenses propres. Indépendante de la comptabilité école.

---

## 9. Calendrier

Vue calendrier des événements scolaires :
- **Vacances scolaires** (saisie par la direction)
- **Examens** (depuis Gestion des examens)
- **Conseils de classe**
- **Événements** : rentrée, kermesse, sortie, réunion parents
- **Multi-vues** : mois, semaine, jour, agenda
- **Ajouter** : titre, date(s), couleur, description, public visible (parents oui/non)

---

## 10. Gestion des examens

Module dédié aux examens majeurs (composition de fin de trimestre, BAC blanc, etc.) :
- **Créer un examen** : nom, période, classes concernées, matières, dates
- **Salles** : affectation salles + surveillants
- **Convocations** : génération PDF par élève avec son numéro de table
- **Saisie résultats** : tableau de saisie groupée

---

## 11. Messagerie

### 11.1 Messages parents (côté école)

- **Inbox** des messages envoyés par les parents
- **Filtres** : non lus, par parent, par classe de l'enfant
- **Réponse** : un parent = un fil
- **Notification push** envoyée au parent quand l'école répond

### 11.2 Diffusion (envoi école → parents)

- Sélection d'un public (toute l'école / une section / une classe / parents d'un élève précis)
- Message court, optionnellement avec pièce jointe
- Apparaît dans le Portail Parent et en notification push

---

## 12. Panneau Admin (mots de passe, promotion)

Accès : sidebar `🛡 Panneau Admin`. Réservé à Direction / Admin.

### 12.1 Année scolaire

- **Sélecteur année active** : c'est l'année en cours de saisie (ne pas confondre avec « Année consultée »)
- **Changer d'année active** : à utiliser au moment de la rentrée pour basculer toute la saisie sur la nouvelle année

### 12.2 Verrous de saisie

- **Verrou primaire** / **secondaire** / **comptable** : permet au DG de figer une section en lecture seule pour tout le monde (typiquement après clôture de la période)
- **Verrou ouvert / fermé** : toggle simple

### 12.3 Gestion des comptes

- **Tableau** : compte, rôle, dernier login, statut
- **Réinitialiser mot de passe** : génère un nouveau MDP, l'utilisateur devra le changer à la prochaine connexion
- **Voir les identifiants temporaires** : tableau des MDP initiaux non encore changés (utile à l'onboarding)
- **Suspendre/réactiver un compte**

### 12.4 Configuration des rôles (DG uniquement)

- **Personnaliser les libellés** des rôles non-système
- **Définir l'accès** module par module pour chaque rôle Admin (lecture/écriture/aucun)
- Les modules système (compta, admin_panel, parametres, fondation, historique) restent **bloqués en écriture** sauf pour le DG.

### 12.5 Promotion de fin d'année

Bouton **Lancer la promotion** :
1. Choisir l'année source et l'année cible (typiquement N → N+1)
2. **Seuils** : moyenne minimale primaire (5/10), collège/lycée (10/20)
3. **Comportement si pas de notes** : promouvoir / faire redoubler
4. Aperçu : nombre d'élèves promus, redoublés, exclus
5. **Valider** : duplique les fiches élèves dans l'année cible avec leur nouvelle classe (via la table `PROMOTION_SUIVANTE`)

> Cette action est **irréversible** : sauvegardez avant de lancer.

---

## 13. Historique des actions

Toutes les actions sensibles sont journalisées :
- Création/modification/suppression d'élèves, classes, notes
- Saisies comptables (recettes, dépenses, paie)
- Changements de paramètres
- Connexions/déconnexions des comptes

Filtres : par utilisateur, type d'action, période. Utile pour les audits et investigations.

---

## 14. Portail Enseignant

Accès : un enseignant se connecte avec son login. 6 onglets.

### 14.1 Dashboard

- Cartes : mes classes, mes heures cette semaine, mes notes en attente
- Mes prochaines séances (extrait EDT)
- Mes signalements récents

### 14.2 EDT (Emploi du temps)

- Grille hebdo des cours de l'enseignant (lecture seule — l'EDT est composé par la direction)
- Bouton **Imprimer mon EDT**

### 14.3 Notes

- Sélectionner classe + type d'évaluation + période
- Mode **liste** : ajouter une note unique par élève
- Mode **saisie en grille** : tableau de toute la classe, saisir toutes les notes en une page
- Modifier / supprimer une note précédemment saisie

### 14.4 Élèves

- Liste de tous les élèves des classes enseignées
- Voir la fiche élève (notes, infos parents)
- **Signaler un incident** : absence, retard, indiscipline — apparaît immédiatement chez la direction et le parent concerné

### 14.5 Absences

Deux sections :
- **Mes signalements** : les incidents que j'ai créés (modifiable/supprimable par moi)
- **Mes événements d'enseignement** : les cours faits/non faits saisis par la comptabilité (lecture seule)

### 14.6 Salaire

- Historique mensuel de mes paies
- Détail d'une fiche de paie (heures, prime, frais annexes, bons, net)
- Bouton **Imprimer mes fiches de paie** (mois courant ou cumul année)

---

## 15. Portail Parent

Accès : un parent se connecte avec son login. 6 onglets.

### 15.1 Dashboard

- **Mes enfants** : carte par enfant avec photo, classe, moyenne en cours
- **Alertes** : mensualités impayées, message non lu, devoirs en retard
- **Bandeau blocage paiement** (si applicable) : si une école active le blocage, le parent voit un bandeau l'invitant à régulariser avant d'accéder aux notes/bulletins

### 15.2 Notes

- Onglet par enfant
- Tableau sticky des notes : matière, type, période, note, appréciation
- Moyenne périodique et annuelle calculées
- Tendance (📈 progression / 📉 baisse)

### 15.3 Absences

- Liste des absences et incidents par enfant
- Détail : date, type, justifié, motif, signalé par
- Bouton **Justifier** : envoie un message à l'école

### 15.4 Bulletins

- Bulletins publiés par l'école, par période
- **Télécharger PDF** (avec footer légal)
- Archivage par année

### 15.5 Paiements

- Mes mensualités : statut par mois (payé / dû / à venir)
- Historique des reçus avec téléchargement PDF
- **Bouton « Payer »** *(selon configuration de l'école)* : ouvre les contacts Mobile Money / instructions de virement

### 15.6 Messages

- Conversation avec l'école (un fil unique par parent)
- Notifications push à chaque nouveau message

---

## 16. Recherche globale & raccourcis

### 16.1 Recherche globale

- Raccourci : **Ctrl + K** (ou cliquer sur 🔍 dans le header)
- Tape un nom, un matricule, un nom de classe ou un nom de module
- Résultats classés par catégorie : Élèves, Enseignants, Parents, Modules
- Navigation au clavier : ↑ / ↓ pour parcourir, **Enter** pour ouvrir, **Echap** pour fermer

### 16.2 Raccourcis clavier

| Touche | Action |
|---|---|
| `Ctrl + K` | Ouvrir la recherche globale |
| `?` | Afficher l'aide raccourcis |
| `Echap` | Fermer modal / panneau |
| `Tab` / `Shift+Tab` | Passer au champ suivant / précédent |
| `Enter` | Valider / confirmer |

---

## 17. Conformité légale & archives

### 17.1 Conformité légale

Le module Conformité (`Paramètres → Officiel`) centralise les pièces réglementaires :
- Promoteur, autorisation de création, agrément, codes statistiques, cycles enseignés
- Le **widget tableau de bord** affiche un compte à rebours sur l'expiration de l'agrément (alerte si < 90 jours)
- Le **footer print** des bulletins/attestations reprend automatiquement les références légales

### 17.2 Archive multi-années

- Toutes les collections métier (élèves, classes, notes, paiements, salaires, etc.) portent un champ `annee`
- Le sélecteur **« Année consultée »** (dans Comptabilité et la page École) permet de consulter une année passée en lecture seule
- Pour saisir sur une nouvelle année, le DG bascule **« Année active »** dans `Panneau Admin → Année scolaire`
- Aucune donnée n'est supprimée lors d'un changement d'année — tout reste consultable

### 17.3 Migration des données historiques

Si vous arrivez d'un système précédent ou d'une version antérieure d'EduGest, contactez votre Super-Admin. Une migration legacy est disponible depuis le `SuperAdminPanel` pour rétroaffecter le champ `annee` aux données existantes.

---

## 18. FAQ & dépannage

**Q. Je ne vois plus mes données / je vois seulement le primaire.**
R. Vérifiez le sélecteur « Année consultée » en haut de la page. Vous êtes peut-être sur une année antérieure ou postérieure. Comparez avec l'« Année active » dans Panneau Admin.

**Q. Un enseignant supprimé continue d'apparaître dans le sélecteur des bons (Comptabilité → Salaires).**
R. Corrigé depuis la version 2026-05 — le sélecteur n'affiche désormais que les enseignants présents dans les collections actuelles.

**Q. La page reste sur « Chargement… » indéfiniment.**
R.
1. Vérifiez votre connexion Internet
2. F12 → onglet **Application → Service Workers → Unregister** + **Storage → Clear site data**
3. Rechargez avec **Ctrl + Shift + R**

**Q. J'ai perdu mon mot de passe.**
R. Un administrateur (DG ou Admin avec accès) peut le réinitialiser depuis `Panneau Admin → Comptes`.

**Q. Comment changer la langue de l'interface ?**
R. Menu profil (en haut à droite) → 🌐 Langue → FR / EN / AR. Le RTL s'active automatiquement en arabe.

**Q. Comment changer la devise affichée ?**
R. `Paramètres → Affichage → Devise`. La nouvelle devise s'applique partout, y compris dans les PDF générés.

**Q. Les bulletins ne contiennent pas mes infos légales.**
R. Vérifiez que `Paramètres → Officiel` est complet (promoteur, agrément, etc.). Les bulletins lisent automatiquement ces données pour le footer.

**Q. Je veux désactiver une section (par ex. on n'a plus de Lycée).**
R. `Paramètres → Identité → Sections actives` → décocher *Lycée*. Le menu disparaît, les données restent accessibles via l'archive.

**Q. Comment notifier une fermeture d'école pour cause d'épidémie ?**
R. `Calendrier` → ajouter un événement « Fermeture » visible par les parents. Doublez d'un message global via `Messages parents → Diffusion`.

**Q. L'erreur « Element type is invalid » apparaît sur Super-Admin.**
R. Bug corrigé dans la version 2026-05-21. Si vous le voyez encore, désinscrivez le Service Worker (cf. plus haut) et rechargez.

**Q. Je vois des erreurs `permission-denied` dans la console après une coupure réseau.**
R. C'est un comportement normal du token JWT qui a expiré pendant la déconnexion. Depuis 2026-05-21, ces erreurs sont automatiquement silencées par le client.

---

## Annexe — Plans & limites

| Plan | Élèves max | Modules |
|---|---|---|
| Découverte | ~50 | Base : élèves, classes, notes |
| Standard | 500 | + paiements, bulletins simples |
| Pro | 2000 | + EDT, bulletins personnalisés, exports |
| Premium | Illimité | + fondation, rapports avancés, multi-écoles |

> Pour mettre à jour votre plan : `Paramètres → Officiel → Plan actuel → bouton « Mettre à niveau »`, ou contactez votre Super-Admin.

---

*Document généré à partir de la base EduGest. Pour toute question opérationnelle, joignez votre Super-Admin via les contacts de l'éditeur.*

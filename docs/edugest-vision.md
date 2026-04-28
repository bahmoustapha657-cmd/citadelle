# EduGest — Vision produit, capacités et potentialités

Document de référence stratégique. Couvre ce qu'est EduGest aujourd'hui, comment il est construit, ce qu'il peut devenir, et les leviers à activer pour passer d'un produit fonctionnel à un standard sectoriel en Afrique francophone.

---

## 1. Résumé exécutif

EduGest (nom de code interne : Citadelle) est une plateforme SaaS de gestion scolaire conçue spécifiquement pour les établissements privés et publics d'Afrique francophone, avec un focus initial sur la Guinée. Le produit couvre l'intégralité du cycle de vie scolaire : inscription des élèves, scolarité (notes, absences, bulletins), comptabilité (mensualités, paie, recettes/dépenses), communication (parents, enseignants, direction), et pilotage stratégique (tableaux de bord, exports, archives).

L'application est multi-tenant (chaque école a son espace cloisonné), multi-section (Primaire, Collège, Lycée), multi-rôle (direction, administration, comptable, enseignants, parents) et fonctionne aussi bien au bureau qu'en mobilité grâce à son architecture PWA installable. Elle intègre les paiements mobile money locaux (Orange Money, MTN Money, Moov Money) via Kkiapay et expose un portail public personnalisé par école.

Le produit est en production, déployé chez plusieurs écoles pilotes, et possède l'ensemble des briques techniques nécessaires pour passer à l'échelle sans réécriture majeure.

---

## 2. Contexte et problème adressé

### 2.1 Réalité du terrain en Afrique francophone

La gestion administrative des écoles en Guinée et plus largement en Afrique de l'Ouest francophone repose encore très majoritairement sur :

- Des cahiers manuscrits pour les notes, les absences et les paiements de mensualités
- Des fichiers Excel locaux non synchronisés, fragiles, perdus ou corrompus
- Des solutions logicielles importées (Pronote, École Directe) inadaptées car conçues pour le système français : pas de mobile money, pas de gestion des sections guinéennes, prix en euros, support distant
- Une absence quasi totale de communication structurée parents-école (les annonces se font de bouche à oreille ou par WhatsApp informel)

### 2.2 Conséquences pour les acteurs

- **Directions** : aucune visibilité consolidée sur les impayés, les effectifs, la rentabilité par classe
- **Comptables** : double saisie permanente, erreurs de calcul, pertes de revenus dues aux mensualités non recouvrées
- **Enseignants** : aucun outil pour partager les notes ou suivre la progression d'un élève d'une année sur l'autre
- **Parents** : opacité totale sur la scolarité, découverte des problèmes en fin de trimestre quand il est trop tard
- **Élèves transférés** : redémarrent à zéro car aucun dossier n'est transmissible

### 2.3 Pourquoi EduGest plutôt que les solutions existantes

| Critère | Solutions importées (Pronote, etc.) | Solutions locales artisanales | EduGest |
|---|---|---|---|
| Adapté aux sections guinéennes (Primaire/Collège/Lycée) | Non | Partiellement | Oui, natif |
| Mobile money intégré | Non | Rare | Oui (Orange/MTN/Moov via Kkiapay) |
| Multi-école avec super-admin | Non | Non | Oui |
| Mode hors-ligne (PWA) | Limité | Non | Oui |
| Tarification en GNF (Franc guinéen) | Non | Oui | Oui |
| Bulletins au format guinéen | Non | Oui | Oui |
| Support en français + créole guinéen possible | Non | Non | Oui (architecture i18n prête) |

---

## 3. Architecture technique

### 3.1 Stack actuelle

**Frontend**
- React 19 (avec React Compiler activé pour la mémoïsation automatique)
- Vite (bundler moderne, hot reload sub-seconde)
- Lazy loading systématique des panneaux lourds (Comptabilité, Examens, Livrets, Portails) via `lazy()` + `Suspense`
- PWA installable (service worker, cache stratifié, fonctionnement offline pour les actions de lecture)
- Recharts pour les graphiques du tableau de bord
- xlsx (SheetJS) pour les imports/exports Excel
- jsPDF / impression native pour les bulletins, cartes, attestations

**Backend**
- Firebase Authentication (gestion identité, custom claims `role` et `schoolId`)
- Cloud Firestore (base NoSQL temps réel, règles de sécurité côté serveur)
- Firebase Storage (photos élèves, logos écoles)
- Firebase Cloud Messaging (notifications push web)
- Vercel Serverless Functions (Node.js) pour les opérations sensibles : login, inscription école, gestion comptes, webhooks paiement, transferts inter-écoles, IA

**Paiements**
- Intégration Kkiapay (passerelle Guinée/Bénin/Côte d'Ivoire) supportant Orange Money, MTN Money, Moov Money, et carte bancaire
- Webhook signé HMAC pour la confirmation serveur

**Sécurité**
- Authentification par tokens Firebase (JWT) à courte durée de vie
- Custom claims propagés dans les règles Firestore (vérification rôle + école sur chaque lecture/écriture)
- Whitelist stricte des collections autorisées (toute collection non listée est refusée)
- Rate limiting côté serveur sur les endpoints sensibles (login : 10/15 min, inscription : 5/24 h, super-admin login : 5/h)
- bcrypt pour les hashes de mots de passe (10 rounds)
- Content Security Policy stricte (script-src 'self', object-src 'none', frame-ancestors 'none')
- Headers HTTP de sécurité (HSTS 2 ans, X-Frame-Options DENY, Permissions-Policy restrictive, Referrer-Policy)
- Vérification HMAC des webhooks Kkiapay
- CORS verrouillé sur l'origine de l'application

### 3.2 Architecture multi-tenant

Chaque école est identifiée par un `schoolId` unique (slug normalisé). Les données sont stockées dans `/ecoles/{schoolId}/...` avec sous-collections cloisonnées :

```
/ecoles/{schoolId}/
  ├── comptes               (utilisateurs internes : direction, admin, comptable, enseignants, parents)
  ├── elevesPrimaire        (fiches élèves Primaire)
  ├── elevesCollege         (fiches élèves Collège)
  ├── elevesLycee           (fiches élèves Lycée)
  ├── classesPrimaire       (CP1, CP2, CE1, CE2, CM1, CM2)
  ├── classesCollege        (7e, 8e, 9e, 10e)
  ├── classesLycee          (11e, 12e, Tle)
  ├── classesX_matieres     (matières par classe)
  ├── classesX_emplois      (emplois du temps)
  ├── ensX                  (fiches enseignants)
  ├── ensX_enseignements    (affectations enseignant ↔ classe ↔ matière)
  ├── notesPrimaire/Collège/Lycee
  ├── elevesX_absences
  ├── recettes              (revenus mensualités, inscriptions, autres)
  ├── depenses              (charges école)
  ├── salaires              (paie personnel)
  ├── bons                  (bons de caisse, avances)
  ├── personnel             (non-enseignants : agents, surveillants, sécurité)
  ├── tarifs                (grille tarifaire par classe)
  ├── versements            (versements à la fondation/groupe)
  ├── messages              (correspondance école ↔ parents)
  ├── annonces              (publications publiques)
  ├── honneurs              (tableau d'honneur)
  ├── examens               (sessions d'examens internes)
  ├── livrets               (livrets scolaires de fin d'année)
  ├── evenements            (calendrier scolaire)
  ├── historique            (audit log des actions sensibles)
  ├── pushSubs              (abonnements push notifications)
  ├── demandes_plan         (demandes d'upgrade tarifaire)
  ├── membres               (membres fondation/groupe scolaire)
  └── documents             (documents administratifs)
```

Un espace `superadmin` séparé permet la gestion globale : provisioning des écoles, communications transversales, supervision des paiements, activation/désactivation des plans.

### 3.3 Fiabilité et performance

- Tous les écrits critiques (mensualités, salaires, transferts) sont **idempotents** côté serveur grâce à des vérifications de doublons logiques (matricule, login, identité élève + classe + section).
- Les listings volumineux utilisent des subscriptions Firestore en temps réel, avec mise à jour incrémentale (le navigateur ne recharge que les documents modifiés).
- Le service worker met en cache l'app shell (CacheFirst) et les photos (CacheFirst longue durée), tandis que les API et Firestore restent en NetworkFirst pour toujours servir des données fraîches.
- L'application est testée fonctionnellement via la `functional-smoke-checklist` avant chaque déploiement majeur.

---

## 4. Modules fonctionnels actuels

### 4.1 Module Élèves

- Création, modification, désactivation de fiches élèves avec tous les champs administratifs : matricule auto-généré, IEN (identifiant national), nom, prénom, sexe, date et lieu de naissance, classe, section, tuteur légal, contact tuteur, filiation, domicile, statut, type d'inscription (Première inscription / Réinscription).
- Photo d'identité optionnelle stockée sur Firebase Storage avec compression côté client.
- Détection automatique des doublons à la création et à l'import (par matricule, IEN, ou triplet nom+prénom+classe).
- Génération de **matricules uniques** par lot lors d'imports massifs (l'algorithme accumule les matricules générés dans le lot pour éviter les collisions).
- Import Excel par section avec auto-détection des en-têtes, mapping intelligent des colonnes, prévisualisation, signalement des erreurs et avertissements ligne par ligne, création automatique des classes manquantes.
- Export Excel et impression de listes de classe formatées.
- Impression de cartes d'élèves avec photo et code-barres.
- Impression d'attestations de scolarité.
- Suivi des transferts inter-écoles avec dossier complet transmis.

### 4.2 Module Notes et Évaluations

- Saisie des notes par classe, matière, période (T1/T2/T3), type (Devoir, Interrogation, Examen, Composition).
- Note maximale paramétrable par section (généralement /20 mais ajustable).
- Import Excel de notes en masse avec validation et prévisualisation.
- **Bulletins automatisés** : moyennes par matière, moyenne générale, rang, appréciation, mention, distinction (Tableau d'honneur, Tableau d'excellence).
- Bulletins individuels imprimables, mais aussi **bulletins groupés** d'une classe entière en un PDF.
- Fiche de compositions par classe (récapitulatif tableau).
- Module Livrets scolaires : agrégation annuelle des bulletins en livret final.

### 4.3 Module Absences et Présence

- Saisie quotidienne des absences par classe.
- Absences justifiées vs non justifiées.
- Statistiques d'assiduité par élève / par classe / par mois.
- Alerte si un élève dépasse un seuil (ex : 5 absences non justifiées sur le mois).

### 4.4 Module Enseignants et Personnel

- Fiches enseignants avec section, matière(s), affectations aux classes.
- Emplois du temps par classe, avec slots horaires personnalisables (30 min, 1h, 1h30, 2h, 4h pour les matières longues type Étude/Histoire-Géo combinée).
- Calcul automatique du **volume horaire hebdomadaire** par enseignant.
- Calcul automatique des **salaires basés sur les heures effectives** + primes de révision + primes spéciales (PPC = Prime Personnel Cadre).
- Fiches personnel non-enseignant (agents, surveillants, gardiens) avec paie indépendante.
- Module Paie avec génération automatique des salaires du mois (en un clic), édition individuelle, archivage.

### 4.5 Module Comptabilité

- **Tarifs par classe** : mensualité de base + frais de révision + autres frais + droit d'inscription + droit de réinscription. Ces composantes sont facturées séparément mais la mensualité totale est automatiquement calculée pour affichage.
- **Mensualités élèves** : suivi mois par mois du statut (Payé / Impayé / En cours), avec alertes pour les élèves ayant 3 mois ou plus d'impayés cumulés.
- **Recettes** : enregistrement de tous les encaissements (mensualités, inscriptions, événements, dons) avec catégorisation et rapprochement.
- **Dépenses** : enregistrement des sorties (loyer, électricité, fournitures, salaires, etc.) avec catégories standardisées.
- **Versements** : transferts vers la fondation ou le groupe scolaire (pour les écoles affiliées à un réseau).
- **Bons de caisse** : avances sur salaire, bons de transport, justifiés par pièces.
- **Tableaux de bord financiers** : recettes vs dépenses par mois, marge mensuelle, projection trésorerie.
- Export Excel de tous les rapports comptables pour transmission au cabinet comptable externe.

### 4.6 Module Paiement en ligne (Kkiapay)

- Les directions peuvent demander un upgrade de plan via un formulaire.
- Le paiement est confirmé par un webhook signé HMAC qui active automatiquement le plan dans Firestore.
- Support des plans : Découverte (gratuit limité), Starter, Pro, Premium.
- Renouvellement automatique annuel possible.
- Désactivation auto en fin d'abonnement avec préavis.

### 4.7 Module Communication

- **Annonces publiques** : visibles par tous, y compris non-connectés, sur le portail public de l'école.
- **Messages école ↔ parents** : sujet + corps, avec accusé de lecture côté école, et restrictions strictes (un parent ne peut écrire que ses propres threads, jamais modifier ni supprimer).
- **Notifications push** : envoi ciblé par rôle ou par classe (rentrée, jour férié, alerte impayé, etc.).
- **Messages SuperAdmin → écoles** : canal de diffusion descendante, avec niveaux info / important / critique. Les messages important/critique affichent un bandeau d'alerte qui ne disparaît qu'après lecture explicite.
- **Cloche flottante** dans toute l'app pour signaler les nouveaux messages SuperAdmin.

### 4.8 Module Calendrier

- Événements scolaires (rentrée, vacances, examens, journées culturelles).
- Vue mensuelle ou liste.
- Visible par tous les rôles autorisés.

### 4.9 Module Recherche globale

- Barre de recherche transversale dans l'app : trouve un élève, un enseignant, un parent par nom, matricule, login, en quelques caractères, toutes sections confondues.

### 4.10 Module Tableau de bord

- Vue synthétique pour la direction : effectifs par section, taux d'occupation par classe, recettes/dépenses du mois, alertes impayés, événements à venir, dernières notes saisies.
- Graphiques d'évolution des effectifs et des recettes sur 12 mois glissants.
- Génération de rapports mensuels au format PDF pour conseil d'administration.

### 4.11 Module Historique (audit log)

- Toutes les actions sensibles (création/suppression d'élève, paiement, modification de tarif, génération de salaires, suppression de note) sont loguées avec auteur, timestamp, détails.
- Consultable par la direction et l'admin pour audit et résolution de litiges.

### 4.12 Module Examens

- Création de sessions d'examens internes (BEPC blanc, Bac blanc, compositions trimestrielles).
- Affectation des matières et coefficients.
- Saisie des notes et calcul automatique des résultats.
- Production des relevés de notes et procès-verbaux.

### 4.13 Module Tableau d'honneur

- Saisie manuelle ou automatique (basée sur la moyenne générale) des élèves méritants.
- Affichage public sur le portail école avec photo.

### 4.14 Module Fondation / Groupe scolaire

- Pour les écoles appartenant à un groupe ou à une fondation : gestion des membres du conseil, documents officiels, versements consolidés des établissements affiliés.

### 4.15 Module Inscription publique

- Formulaire d'inscription d'une nouvelle école accessible sur le portail principal d'EduGest.
- Vérification anti-spam, normalisation, génération automatique du `schoolId` et des comptes par défaut (direction, admin, comptable selon configuration).
- Génération de mots de passe initiaux sécurisés (entropy ≥ 128 bits) communiqués à l'école.
- Synchronisation immédiate vers la collection publique `ecoles_public` pour visibilité.

### 4.16 Module Portail Public

- Chaque école a son URL publique (`/ecole/{slug}`) avec :
  - Logo et couleurs personnalisés
  - Slogan et texte d'accueil
  - Liste des annonces récentes
  - Tableau d'honneur
  - Coordonnées et localisation
- Aucune authentification requise pour la consultation, idéal pour les parents prospects.

### 4.17 Module Portail Parent

- Vue dédiée aux parents avec :
  - Bulletins de leurs enfants en lecture seule
  - Statut des mensualités et historique des paiements
  - Calendrier scolaire
  - Annonces de l'école
  - Messagerie pour contacter l'administration
- Un parent peut être lié à plusieurs enfants. Le système détecte automatiquement les foyers identiques (même tuteur + filiation + contact) et fusionne les comptes pour éviter les doublons : un seul login pour tous les enfants d'une même famille.

### 4.18 Module Portail Enseignant

- Vue dédiée aux enseignants avec :
  - Leurs classes et matières uniquement
  - Saisie de notes restreinte à leur périmètre
  - Saisie d'absences pour leurs cours
  - Annonces internes
  - Pas d'accès aux données financières

### 4.19 Module SuperAdmin

- Console centrale pour le propriétaire de la plateforme :
  - Liste de toutes les écoles avec statut, plan, dernier paiement
  - Activation / désactivation manuelle de plans
  - Communications transversales (broadcast à toutes les écoles ou à un sous-ensemble)
  - Supervision des demandes d'upgrade
  - Statistiques globales d'usage
  - Gestion des super-admins eux-mêmes
- Authentification renforcée (compte séparé, rate limit strict 5 tentatives par heure, login dédié).

---

## 5. Sécurité et conformité

EduGest a fait l'objet d'un travail de durcissement systématique. Les mesures en place incluent :

### 5.1 Authentification
- Tokens JWT Firebase à durée limitée (1h) avec refresh automatique.
- Custom claims signés côté serveur (`role`, `schoolId`) propagés dans les règles Firestore.
- bcrypt 10 rounds pour les hashes de mots de passe (résistant au brute force GPU).
- Mot de passe initial obligatoire à 8 caractères minimum, changement forcé à la première connexion (`premiereCo`).

### 5.2 Autorisation
- Règles Firestore avec **whitelist explicite** : chaque collection est listée nommément avec ses règles d'accès. Toute collection non whitelistée est refusée en lecture **et** en écriture.
- Validation du schéma à la création des comptes (clés autorisées, longueur min/max, format login).
- Restriction stricte des écritures parents : un parent ne peut créer que ses propres messages (`expediteur === "parent"`, sujet 1-200 caractères, corps 1-5000 caractères), jamais modifier ni supprimer.
- Cloisonnement total entre écoles (un user d'école A ne peut jamais lire les données d'école B).

### 5.3 Protection des endpoints
- Rate limiting Firestore-based sur login (10/15min), inscription école (5/24h), super-admin (5/h).
- Vérification CORS same-origin pour toutes les API.
- Validation stricte des inputs (longueur, format, type) avant tout accès DB.
- Les endpoints sensibles exigent un Bearer token Firebase valide + vérification de rôle + vérification de scope école.

### 5.4 Protection navigateur
- **Content Security Policy** stricte : `script-src 'self'` (pas de eval, pas de inline), `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`.
- HSTS 2 ans avec `includeSubDomains` et `preload`.
- X-Frame-Options DENY (pas d'embedding possible dans un iframe tiers).
- X-Content-Type-Options nosniff.
- Permissions-Policy restrictive (geo, micro, caméra désactivés ; payment limité à Kkiapay).

### 5.5 Webhook de paiement
- Vérification HMAC de la signature Kkiapay sur chaque notification.
- Idempotency key pour éviter les doubles activations.

### 5.6 Audit
- Toutes les actions sensibles loguées dans `historique` avec auteur, timestamp, détails.
- SuperAdmin a accès à un journal global des paiements et des connexions suspectes.

### 5.7 Conformité
- Architecture compatible RGPD-like (le schoolId cloisonne les données, droit à l'effacement implémentable via suppression de la sous-arborescence).
- Mots de passe jamais stockés en clair, jamais loggés.
- Tokens jamais stockés côté serveur (stateless JWT).

Le document `docs/security-architecture.md` détaille la défense en profondeur et le modèle de menace.

---

## 6. Modèle économique

### 6.1 Structure tarifaire envisagée (à valider par les premiers tests marché)

| Plan | Cible | Prix mensuel (GNF) | Élèves max | Modules inclus |
|---|---|---|---|---|
| Découverte | Test gratuit 30 jours | 0 | 50 | Élèves, Notes, Bulletins basiques |
| Starter | Petite école (< 200 élèves) | 200 000 | 200 | + Comptabilité, Annonces, Parents |
| Pro | École moyenne (200-600 élèves) | 500 000 | 600 | + Examens, Livrets, Push, Multi-section |
| Premium | Grande école / groupe (600+) | 1 000 000+ | Illimité | + Fondation, Multi-école, IA, Support prioritaire |

À titre de référence : 1 USD ≈ 8 600 GNF en 2026. Une école de 300 élèves payant 200 000 GNF/mois représente environ 23 USD/mois, soit ~660 GNF/élève — négligeable face au coût d'un seul cahier de notes perdu.

### 6.2 Acquisition

- Démarchage direct des directions d'écoles privées dans Conakry.
- Partenariat avec les fédérations d'écoles privées (FENEEPEG, FENECOPE en Guinée).
- Démos gratuites en présentiel.
- Programme de parrainage (école qui amène une école : 1 mois offert).
- Présence physique aux salons éducation (Salon de l'Éducation et de la Formation de Conakry).

### 6.3 Rétention

- Onboarding accompagné lors des 30 premiers jours (coaching de 2-3 sessions).
- Hotline WhatsApp/téléphone en français pour le support.
- Mises à jour fonctionnelles régulières (signal de produit vivant).
- Newsletter mensuelle à la direction sur les nouveautés.

### 6.4 Projection à 24 mois (scénario médian)

| Mois | Écoles | MRR (GNF) | MRR (USD) |
|---|---|---|---|
| M3 | 5 | 1 000 000 | 116 |
| M6 | 15 | 4 500 000 | 523 |
| M12 | 40 | 14 000 000 | 1 628 |
| M18 | 80 | 30 000 000 | 3 488 |
| M24 | 150 | 60 000 000 | 6 977 |

À 150 écoles, l'ARR (revenus annualisés) atteint ~85 000 USD. Avec une équipe lean de 2-3 personnes (dev + commercial + support), la marge nette projetée est ≥ 50%.

---

## 7. Marché et positionnement

### 7.1 Taille du marché en Guinée

- Population scolarisée : ~3,5 millions d'élèves (2024).
- Établissements : ~13 000 écoles primaires, ~2 500 collèges, ~1 200 lycées.
- Privé / public : ~25% des élèves en privé en zone urbaine (≈ 200 000 élèves dans le secteur privé urbain, principalement Conakry, Kindia, Kankan, Labé).
- Cible adressable réaliste sur 5 ans : 2 000 écoles privées payantes.
- Marché total adressable (TAM) Guinée : ~4 800 USD/mois × 2 000 = 9,6 M USD/an. SAM cible 5 ans : 1,5 à 2 M USD ARR.

### 7.2 Expansion régionale

L'architecture multi-tenant + l'adaptation aux mobile money locaux permettent un déploiement en :
- **Côte d'Ivoire** (15M scolarisés, mobile money mature, écoles privées nombreuses)
- **Sénégal** (forte tradition d'écoles privées, infrastructure numérique solide)
- **Mali, Burkina Faso, Bénin, Togo** (marchés similaires à la Guinée en taille et maturité)
- **Cameroun, RDC** (gros volumes, complexité plus élevée mais ARR potentiel énorme)

Le passage à un nouveau pays se fait essentiellement par : ajout des classes locales, intégration d'un opérateur mobile money local (Wave au Sénégal, MTN MoMo Cameroun, etc.), traduction marketing si nécessaire.

### 7.3 Concurrence

- **Pronote / École Directe** : non adaptés Afrique francophone, pas de mobile money, prix en euros, support distant. Présents marginalement dans les écoles internationales.
- **Solutions locales artisanales** : généralement des fichiers Excel ou des logiciels desktop sans cloud, sans communication parents, sans paiement intégré. Faible barrière à concurrencer.
- **Solutions africaines généralistes** (Mboalab, EdTech Africa) : peu spécialisées scolaire, pas multi-tenant, peu de traction réelle.
- **Risque entrant** : un Pronote francisé pour l'Afrique (peu probable car peu rentable pour eux), ou un nouvel entrant africain bien capitalisé (suivre Vodacom, Orange Foundation, CFA EdTech).

EduGest a actuellement une **fenêtre de 18-24 mois** pour s'imposer comme standard avant qu'un acteur capitalisé ne tente l'entrée.

### 7.4 Avantages concurrentiels durables

1. **Spécialisation locale** : seul produit conçu nativement pour le système éducatif guinéen / ouest-africain.
2. **Mobile money intégré** : levier d'adoption massif, indispensable et difficile à ajouter rétro-activement par un concurrent.
3. **Multi-tenant + multi-école** : permet aux groupes scolaires (fondations, congrégations) de centraliser sans surcoût.
4. **PWA offline** : fonctionne dans les zones à connexion intermittente, là où les concurrents desktop ou full-cloud échouent.
5. **Modèle freemium** : test gratuit 30 jours sans CB, levée d'objection forte.
6. **Support en français + identité africaine** : crédibilité culturelle vs solutions importées.

---

## 8. Roadmap produit

### 8.1 Court terme (3 mois)

- **Module SMS de masse** : envoi aux parents (rappel impayé, absence, résultats) via passerelle SMS locale (Orange Guinea SMS API ou Africa's Talking). Cas d'usage critique car de nombreux parents n'ont pas de smartphone.
- **Application mobile parent native** (Capacitor sur le code React existant ou React Native) pour Play Store et App Store.
- **Mode hors-ligne complet** : permettre la saisie de notes/absences sans connexion, synchronisation au retour réseau (Firestore offline persistence + queue locale).
- **Génération IA des appréciations de bulletin** via Anthropic Claude API : l'enseignant écrit 3 mots-clés, l'IA génère une appréciation rédigée. Économie de temps massive en période de bulletin.
- **Plan tarifaire en GNF affiché** dans l'UI (actuellement les plans sont prêts mais l'UX d'achat doit être finalisée).

### 8.2 Moyen terme (6-12 mois)

- **Module Bibliothèque** : catalogue des livres, prêts/retours, abonnements élèves.
- **Module Cantine** : gestion des tickets repas, abonnements mensuels, facturation séparée des mensualités.
- **Module Transport scolaire** : circuits, abonnements, suivi des trajets (option GPS pour véhicules équipés).
- **Module Suivi médical** : fiche médicale élève, vaccinations, allergies, traitements en cours, accès infirmerie.
- **Examens nationaux** : préparation BEPC, BAC avec banque d'annales, examens blancs, statistiques de performance.
- **Multi-langue** : arabe pour les écoles bilingues franco-arabes, anglais pour anticiper l'expansion en Afrique anglophone.
- **Marketplace de contenus pédagogiques** : enseignants vendent leurs cours / supports à d'autres écoles (revenu partagé EduGest 15%).
- **API publique** : permet à des partenaires (cabinets comptables, ministère de l'éducation) de consommer les données autorisées.

### 8.3 Long terme (12-36 mois)

- **Plateforme LMS intégrée** : cours en ligne, devoirs à rendre numériquement, classe virtuelle (intégration Jitsi ou Whereby).
- **IA pédagogique avancée** : détection précoce de décrochage scolaire (analyse notes + absences + comportement), recommandations personnalisées par élève, génération de plans de remédiation.
- **Orientation post-bac** : module dédié aux élèves de Terminale, avec base de données universitaires (Guinée, Maroc, Sénégal, France) et coaching IA.
- **Suivi compétences** (CECRL et approche par compétences ministère) : transition progressive du système notation pure vers l'évaluation par compétences.
- **Intégration ministère de l'Éducation** : remontée automatique des effectifs et résultats, évite à chaque école de produire ses statistiques manuellement.
- **Fonctionnalités banques** : prêts scolaires aux parents, paiements échelonnés financés, partenariat banques locales.
- **Édition mobile native iOS + Android complète** (pas juste parent) avec sync Firebase, offline, push, équivalente à la version web.
- **Support B2G** : vente de la plateforme à des collectivités/municipalités pour gérer toutes leurs écoles publiques.

---

## 9. Potentialités stratégiques

### 9.1 Effets de réseau à exploiter

- **Transferts inter-écoles** : déjà implémenté techniquement. Plus il y a d'écoles sur EduGest, plus le transfert d'un élève devient fluide. Les parents préfèrent les écoles qui sont sur la plateforme parce que c'est plus simple en cas de déménagement.
- **Réputation publique** : le portail public, le tableau d'honneur, les annonces deviennent un canal marketing pour l'école elle-même. Plus EduGest est utilisé, plus les écoles ont intérêt à y être pour ne pas paraître en retard.
- **Données agrégées sectorielles** : à l'échelle, EduGest peut publier des benchmarks anonymes (taux de réussite par section, évolution des effectifs, salaires moyens) qui deviennent une référence pour le secteur — produit dérivé monétisable.

### 9.2 Verticaux à long terme

1. **EduGest Banking** : compte courant scolaire, prêt mensualités, partenariat banque pour le compte d'opérations école.
2. **EduGest Insurance** : assurance scolaire élèves, assurance responsabilité civile école, vendue en marketplace.
3. **EduGest Recruitment** : place de marché des enseignants, vérification antécédents, formation continue en ligne.
4. **EduGest Capital** : fond d'investissement pour la modernisation des écoles (infrastructure, équipement IT, mobilier), remboursé sur les revenus.
5. **EduGest Books** : édition numérique africaine partagée, manuels conformes programmes nationaux disponibles dans la plateforme.

### 9.3 Levée de fonds envisageable

À partir de M18 (~80 écoles, 30 M GNF MRR ≈ 3 500 USD MRR ≈ 42 000 USD ARR), un tour de seed à 500K USD - 1M USD est crédible auprès de fonds spécialisés Afrique :
- **Partech Africa**
- **Norrsken22**
- **Janngo Capital**
- **Catalyst Fund**
- **TLcom Capital**
- **CRE Venture Capital**

Les arguments de pitch : marché énorme et sous-équipé, traction prouvée, rétention probablement excellente (un logiciel scolaire ne se change pas tous les ans), équipe locale crédible, expansion régionale claire.

### 9.4 Acquisition stratégique potentielle

À terme, des acquéreurs naturels sont :
- **Orange Digital Education** ou équivalents télécoms cherchant à diversifier au-delà du mobile money.
- **Groupes éducatifs panafricains** (groupe Yango, BAY Group, ou nouveaux entrants) en consolidation.
- **Acteurs internationaux d'EdTech** entrant en Afrique francophone (Coursera, Pearson, Holberton).

Une valorisation de 5x à 10x ARR n'est pas irréaliste pour un SaaS sectoriel avec rétention forte. À 1M USD ARR, sortie potentielle 5-10M USD.

---

## 10. Risques et défis

### 10.1 Risques techniques

- **Dépendance Firebase** : si Google augmente fortement les prix ou modifie ses CGU, l'impact serait majeur. **Mitigation** : architecture hexagonale partielle (les modules métier ne dépendent pas directement de Firestore), migration possible vers Supabase ou Postgres self-hosted en 1-2 mois.
- **Limites Vercel Hobby (12 fonctions)** : déjà rencontré, mitigé par consolidation en routers d'actions. **Plan B** : Pro à 20 USD/mois si croissance.
- **Latence réseau Guinée** : médiocre dans certaines zones rurales. **Mitigation** : PWA + offline persistence, CDN Cloudflare envisageable.

### 10.2 Risques produit

- **Charge cognitive** : EduGest fait beaucoup de choses, le risque d'overwhelm est réel. **Mitigation** : onboarding progressif, modules désactivables, UI épurée par défaut avec activation à la demande.
- **Imports massifs Excel** : déjà identifié un bug de déconnexion lors d'imports première année (en cours d'investigation). **Mitigation** : observabilité renforcée, retry automatique, queue offline.

### 10.3 Risques marché

- **Pouvoir d'achat** : les écoles privées guinéennes ont des marges fragiles. **Mitigation** : tarification en GNF, paiement en mobile money, plan Découverte gratuit pour acquérir la confiance.
- **Inertie des directions** : changer d'outil est difficile pour un directeur de 60 ans. **Mitigation** : démos en présentiel, accompagnement humain en français.
- **Connectivité dégradée en saison des pluies** : la 4G chute en zone urbaine, certaines zones perdent le réseau. **Mitigation** : mode offline déjà partiellement présent, à étendre.

### 10.4 Risques réglementaires

- **Protection données mineurs** : les élèves sont des mineurs. La législation en Guinée est embryonnaire, mais une mise à niveau RGPD-like est saine. **Mitigation** : consentement parents explicite, droit à l'oubli implémenté.
- **Fiscalité SaaS Guinée** : le statut TVA et IS sur les SaaS étrangers est flou. **Mitigation** : domiciliation locale envisageable (Conakry SARL) pour clarté.

### 10.5 Risques opérationnels

- **Bus factor 1** : actuellement développé par une seule personne. **Mitigation** : documenter, recruter un second développeur dès les premières recettes récurrentes.
- **Support client en croissance** : 1 personne ne peut pas supporter 100 écoles. **Mitigation** : recrutement support à partir de M9, formation des écoles "champions" comme relais communautaires.

---

## 11. Vision long terme

EduGest a la capacité de devenir, d'ici 2030, **l'infrastructure numérique de référence pour la gestion scolaire en Afrique francophone**, à l'image de ce que Pronote a été pour le système français. Les conditions sont réunies :

- Un produit déjà fonctionnel et déployé.
- Un fondateur local crédible.
- Un marché énorme, sous-équipé, en croissance démographique forte.
- Aucun concurrent dominant.
- Un modèle économique sain, encaissable en monnaie locale.
- Une architecture technique scalable sans réécriture.

L'ambition réaliste à 5 ans :
- 5 000 à 10 000 écoles utilisatrices.
- Présence dans 5 pays minimum (Guinée, Côte d'Ivoire, Sénégal, Mali, Burkina Faso).
- 5 à 15 millions USD d'ARR.
- 30 à 60 personnes en équipe.
- Un statut de licorne EdTech africaine atteignable à horizon 8-10 ans.

L'ambition culturelle, plus profonde : moderniser silencieusement la gestion de l'éducation africaine, rendre la scolarité plus transparente pour les parents, plus efficace pour les directions, plus juste pour les élèves transférés ou en difficulté. Un outil banal, devenu indispensable, qui fait que personne ne se rappelle plus comment on faisait avant.

---

## Annexes

### A. Glossaire technique

- **Multi-tenant** : architecture où une seule instance logicielle sert plusieurs clients (écoles) avec cloisonnement strict des données.
- **PWA (Progressive Web App)** : application web installable comme une app native, fonctionnant offline.
- **JWT (JSON Web Token)** : format standard de jeton d'authentification signé.
- **Custom claims** : données personnalisées attachées à un token Firebase (rôle, école).
- **Webhook HMAC** : notification serveur-à-serveur dont l'authenticité est vérifiée par signature cryptographique.
- **Idempotence** : propriété d'une opération qui produit le même résultat même si elle est exécutée plusieurs fois (essentiel pour les paiements).
- **Whitelist** : liste blanche, par opposition à blacklist. En sécurité, on autorise explicitement, on refuse par défaut.

### B. Liens internes

- `docs/security-architecture.md` — Modèle de menace et défense en profondeur.
- `docs/operations-runbook.md` — Procédures opérationnelles (déploiement, incidents, restauration).
- `docs/functional-smoke-checklist.md` — Liste de vérifications pre-deploy.
- `docs/dossier-commercial.html` — Présentation commerciale (clients).
- `docs/pitch-deck.html` — Pitch investisseurs.
- `docs/fiche-produit.html` — Fiche produit synthétique.

### C. Contacts

- Fondateur : Moustapha Bah — bahmoustapha657@gmail.com
- Repository : github.com/bahmoustapha657-cmd/citadelle (privé)

---

*Document maintenu manuellement. Dernière mise à jour : avril 2026.*

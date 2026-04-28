# EduGest â€” Vision produit, capacitÃ©s et potentialitÃ©s

Document de rÃ©fÃ©rence stratÃ©gique. Couvre ce qu'est EduGest aujourd'hui, comment il est construit, ce qu'il peut devenir, et les leviers Ã  activer pour passer d'un produit fonctionnel Ã  un standard sectoriel en Afrique francophone.

---

## 1. RÃ©sumÃ© exÃ©cutif

EduGest (nom de code interne : Citadelle) est une plateforme SaaS de gestion scolaire conÃ§ue spÃ©cifiquement pour les Ã©tablissements privÃ©s et publics d'Afrique francophone, avec un focus initial sur la GuinÃ©e. Le produit couvre l'intÃ©gralitÃ© du cycle de vie scolaire : inscription des Ã©lÃ¨ves, scolaritÃ© (notes, absences, bulletins), comptabilitÃ© (mensualitÃ©s, paie, recettes/dÃ©penses), communication (parents, enseignants, direction), et pilotage stratÃ©gique (tableaux de bord, exports, archives).

L'application est multi-tenant (chaque Ã©cole a son espace cloisonnÃ©), multi-section (Primaire, CollÃ¨ge, LycÃ©e), multi-rÃ´le (direction, administration, comptable, enseignants, parents) et fonctionne aussi bien au bureau qu'en mobilitÃ© grÃ¢ce Ã  son architecture PWA installable. Elle intÃ¨gre les paiements mobile money locaux (Orange Money, MTN Money, Moov Money) en suivi Mobile Money et expose un portail public personnalisÃ© par Ã©cole.

Le produit est en production, dÃ©ployÃ© chez plusieurs Ã©coles pilotes, et possÃ¨de l'ensemble des briques techniques nÃ©cessaires pour passer Ã  l'Ã©chelle sans rÃ©Ã©criture majeure.

---

## 2. Contexte et problÃ¨me adressÃ©

### 2.1 RÃ©alitÃ© du terrain en Afrique francophone

La gestion administrative des Ã©coles en GuinÃ©e et plus largement en Afrique de l'Ouest francophone repose encore trÃ¨s majoritairement sur :

- Des cahiers manuscrits pour les notes, les absences et les paiements de mensualitÃ©s
- Des fichiers Excel locaux non synchronisÃ©s, fragiles, perdus ou corrompus
- Des solutions logicielles importÃ©es (Pronote, Ã‰cole Directe) inadaptÃ©es car conÃ§ues pour le systÃ¨me franÃ§ais : pas de mobile money, pas de gestion des sections guinÃ©ennes, prix en euros, support distant
- Une absence quasi totale de communication structurÃ©e parents-Ã©cole (les annonces se font de bouche Ã  oreille ou par WhatsApp informel)

### 2.2 ConsÃ©quences pour les acteurs

- **Directions** : aucune visibilitÃ© consolidÃ©e sur les impayÃ©s, les effectifs, la rentabilitÃ© par classe
- **Comptables** : double saisie permanente, erreurs de calcul, pertes de revenus dues aux mensualitÃ©s non recouvrÃ©es
- **Enseignants** : aucun outil pour partager les notes ou suivre la progression d'un Ã©lÃ¨ve d'une annÃ©e sur l'autre
- **Parents** : opacitÃ© totale sur la scolaritÃ©, dÃ©couverte des problÃ¨mes en fin de trimestre quand il est trop tard
- **Ã‰lÃ¨ves transfÃ©rÃ©s** : redÃ©marrent Ã  zÃ©ro car aucun dossier n'est transmissible

### 2.3 Pourquoi EduGest plutÃ´t que les solutions existantes

| CritÃ¨re | Solutions importÃ©es (Pronote, etc.) | Solutions locales artisanales | EduGest |
|---|---|---|---|
| AdaptÃ© aux sections guinÃ©ennes (Primaire/CollÃ¨ge/LycÃ©e) | Non | Partiellement | Oui, natif |
| Mobile money intÃ©grÃ© | Non | Rare | Oui (Orange/MTN/Moov en suivi Mobile Money) |
| Multi-Ã©cole avec super-admin | Non | Non | Oui |
| Mode hors-ligne (PWA) | LimitÃ© | Non | Oui |
| Tarification en GNF (Franc guinÃ©en) | Non | Oui | Oui |
| Bulletins au format guinÃ©en | Non | Oui | Oui |
| Support en franÃ§ais + crÃ©ole guinÃ©en possible | Non | Non | Oui (architecture i18n prÃªte) |

---

## 3. Architecture technique

### 3.1 Stack actuelle

**Frontend**
- React 19 (avec React Compiler activÃ© pour la mÃ©moÃ¯sation automatique)
- Vite (bundler moderne, hot reload sub-seconde)
- Lazy loading systÃ©matique des panneaux lourds (ComptabilitÃ©, Examens, Livrets, Portails) via `lazy()` + `Suspense`
- PWA installable (service worker, cache stratifiÃ©, fonctionnement offline pour les actions de lecture)
- Recharts pour les graphiques du tableau de bord
- xlsx (SheetJS) pour les imports/exports Excel
- jsPDF / impression native pour les bulletins, cartes, attestations

**Backend**
- Firebase Authentication (gestion identitÃ©, custom claims `role` et `schoolId`)
- Cloud Firestore (base NoSQL temps rÃ©el, rÃ¨gles de sÃ©curitÃ© cÃ´tÃ© serveur)
- Firebase Storage (photos Ã©lÃ¨ves, logos Ã©coles)
- Firebase Cloud Messaging (notifications push web)
- Vercel Serverless Functions (Node.js) pour les opÃ©rations sensibles : login, inscription Ã©cole, gestion comptes, webhooks paiement, transferts inter-Ã©coles, IA

**Paiements**
- IntÃ©gration paiement Mobile Money (passerelle GuinÃ©e/BÃ©nin/CÃ´te d'Ivoire) supportant Orange Money, MTN Money, Moov Money, et carte bancaire
- Webhook signÃ© HMAC pour la confirmation serveur

**SÃ©curitÃ©**
- Authentification par tokens Firebase (JWT) Ã  courte durÃ©e de vie
- Custom claims propagÃ©s dans les rÃ¨gles Firestore (vÃ©rification rÃ´le + Ã©cole sur chaque lecture/Ã©criture)
- Whitelist stricte des collections autorisÃ©es (toute collection non listÃ©e est refusÃ©e)
- Rate limiting cÃ´tÃ© serveur sur les endpoints sensibles (login : 10/15 min, inscription : 5/24 h, super-admin login : 5/h)
- bcrypt pour les hashes de mots de passe (10 rounds)
- Content Security Policy stricte (script-src 'self', object-src 'none', frame-ancestors 'none')
- Headers HTTP de sÃ©curitÃ© (HSTS 2 ans, X-Frame-Options DENY, Permissions-Policy restrictive, Referrer-Policy)
- VÃ©rification HMAC des webhooks paiement Mobile Money
- CORS verrouillÃ© sur l'origine de l'application

### 3.2 Architecture multi-tenant

Chaque Ã©cole est identifiÃ©e par un `schoolId` unique (slug normalisÃ©). Les donnÃ©es sont stockÃ©es dans `/ecoles/{schoolId}/...` avec sous-collections cloisonnÃ©es :

```
/ecoles/{schoolId}/
  â”œâ”€â”€ comptes               (utilisateurs internes : direction, admin, comptable, enseignants, parents)
  â”œâ”€â”€ elevesPrimaire        (fiches Ã©lÃ¨ves Primaire)
  â”œâ”€â”€ elevesCollege         (fiches Ã©lÃ¨ves CollÃ¨ge)
  â”œâ”€â”€ elevesLycee           (fiches Ã©lÃ¨ves LycÃ©e)
  â”œâ”€â”€ classesPrimaire       (CP1, CP2, CE1, CE2, CM1, CM2)
  â”œâ”€â”€ classesCollege        (7e, 8e, 9e, 10e)
  â”œâ”€â”€ classesLycee          (11e, 12e, Tle)
  â”œâ”€â”€ classesX_matieres     (matiÃ¨res par classe)
  â”œâ”€â”€ classesX_emplois      (emplois du temps)
  â”œâ”€â”€ ensX                  (fiches enseignants)
  â”œâ”€â”€ ensX_enseignements    (affectations enseignant â†” classe â†” matiÃ¨re)
  â”œâ”€â”€ notesPrimaire/CollÃ¨ge/Lycee
  â”œâ”€â”€ elevesX_absences
  â”œâ”€â”€ recettes              (revenus mensualitÃ©s, inscriptions, autres)
  â”œâ”€â”€ depenses              (charges Ã©cole)
  â”œâ”€â”€ salaires              (paie personnel)
  â”œâ”€â”€ bons                  (bons de caisse, avances)
  â”œâ”€â”€ personnel             (non-enseignants : agents, surveillants, sÃ©curitÃ©)
  â”œâ”€â”€ tarifs                (grille tarifaire par classe)
  â”œâ”€â”€ versements            (versements Ã  la fondation/groupe)
  â”œâ”€â”€ messages              (correspondance Ã©cole â†” parents)
  â”œâ”€â”€ annonces              (publications publiques)
  â”œâ”€â”€ honneurs              (tableau d'honneur)
  â”œâ”€â”€ examens               (sessions d'examens internes)
  â”œâ”€â”€ livrets               (livrets scolaires de fin d'annÃ©e)
  â”œâ”€â”€ evenements            (calendrier scolaire)
  â”œâ”€â”€ historique            (audit log des actions sensibles)
  â”œâ”€â”€ pushSubs              (abonnements push notifications)
  â”œâ”€â”€ demandes_plan         (demandes d'upgrade tarifaire)
  â”œâ”€â”€ membres               (membres fondation/groupe scolaire)
  â””â”€â”€ documents             (documents administratifs)
```

Un espace `superadmin` sÃ©parÃ© permet la gestion globale : provisioning des Ã©coles, communications transversales, supervision des paiements, activation/dÃ©sactivation des plans.

### 3.3 FiabilitÃ© et performance

- Tous les Ã©crits critiques (mensualitÃ©s, salaires, transferts) sont **idempotents** cÃ´tÃ© serveur grÃ¢ce Ã  des vÃ©rifications de doublons logiques (matricule, login, identitÃ© Ã©lÃ¨ve + classe + section).
- Les listings volumineux utilisent des subscriptions Firestore en temps rÃ©el, avec mise Ã  jour incrÃ©mentale (le navigateur ne recharge que les documents modifiÃ©s).
- Le service worker met en cache l'app shell (CacheFirst) et les photos (CacheFirst longue durÃ©e), tandis que les API et Firestore restent en NetworkFirst pour toujours servir des donnÃ©es fraÃ®ches.
- L'application est testÃ©e fonctionnellement via la `functional-smoke-checklist` avant chaque dÃ©ploiement majeur.

---

## 4. Modules fonctionnels actuels

### 4.1 Module Ã‰lÃ¨ves

- CrÃ©ation, modification, dÃ©sactivation de fiches Ã©lÃ¨ves avec tous les champs administratifs : matricule auto-gÃ©nÃ©rÃ©, IEN (identifiant national), nom, prÃ©nom, sexe, date et lieu de naissance, classe, section, tuteur lÃ©gal, contact tuteur, filiation, domicile, statut, type d'inscription (PremiÃ¨re inscription / RÃ©inscription).
- Photo d'identitÃ© optionnelle stockÃ©e sur Firebase Storage avec compression cÃ´tÃ© client.
- DÃ©tection automatique des doublons Ã  la crÃ©ation et Ã  l'import (par matricule, IEN, ou triplet nom+prÃ©nom+classe).
- GÃ©nÃ©ration de **matricules uniques** par lot lors d'imports massifs (l'algorithme accumule les matricules gÃ©nÃ©rÃ©s dans le lot pour Ã©viter les collisions).
- Import Excel par section avec auto-dÃ©tection des en-tÃªtes, mapping intelligent des colonnes, prÃ©visualisation, signalement des erreurs et avertissements ligne par ligne, crÃ©ation automatique des classes manquantes.
- Export Excel et impression de listes de classe formatÃ©es.
- Impression de cartes d'Ã©lÃ¨ves avec photo et code-barres.
- Impression d'attestations de scolaritÃ©.
- Suivi des transferts inter-Ã©coles avec dossier complet transmis.

### 4.2 Module Notes et Ã‰valuations

- Saisie des notes par classe, matiÃ¨re, pÃ©riode (T1/T2/T3), type (Devoir, Interrogation, Examen, Composition).
- Note maximale paramÃ©trable par section (gÃ©nÃ©ralement /20 mais ajustable).
- Import Excel de notes en masse avec validation et prÃ©visualisation.
- **Bulletins automatisÃ©s** : moyennes par matiÃ¨re, moyenne gÃ©nÃ©rale, rang, apprÃ©ciation, mention, distinction (Tableau d'honneur, Tableau d'excellence).
- Bulletins individuels imprimables, mais aussi **bulletins groupÃ©s** d'une classe entiÃ¨re en un PDF.
- Fiche de compositions par classe (rÃ©capitulatif tableau).
- Module Livrets scolaires : agrÃ©gation annuelle des bulletins en livret final.

### 4.3 Module Absences et PrÃ©sence

- Saisie quotidienne des absences par classe.
- Absences justifiÃ©es vs non justifiÃ©es.
- Statistiques d'assiduitÃ© par Ã©lÃ¨ve / par classe / par mois.
- Alerte si un Ã©lÃ¨ve dÃ©passe un seuil (ex : 5 absences non justifiÃ©es sur le mois).

### 4.4 Module Enseignants et Personnel

- Fiches enseignants avec section, matiÃ¨re(s), affectations aux classes.
- Emplois du temps par classe, avec slots horaires personnalisables (30 min, 1h, 1h30, 2h, 4h pour les matiÃ¨res longues type Ã‰tude/Histoire-GÃ©o combinÃ©e).
- Calcul automatique du **volume horaire hebdomadaire** par enseignant.
- Calcul automatique des **salaires basÃ©s sur les heures effectives** + primes de rÃ©vision + primes spÃ©ciales (PPC = Prime Personnel Cadre).
- Fiches personnel non-enseignant (agents, surveillants, gardiens) avec paie indÃ©pendante.
- Module Paie avec gÃ©nÃ©ration automatique des salaires du mois (en un clic), Ã©dition individuelle, archivage.

### 4.5 Module ComptabilitÃ©

- **Tarifs par classe** : mensualitÃ© de base + frais de rÃ©vision + autres frais + droit d'inscription + droit de rÃ©inscription. Ces composantes sont facturÃ©es sÃ©parÃ©ment mais la mensualitÃ© totale est automatiquement calculÃ©e pour affichage.
- **MensualitÃ©s Ã©lÃ¨ves** : suivi mois par mois du statut (PayÃ© / ImpayÃ© / En cours), avec alertes pour les Ã©lÃ¨ves ayant 3 mois ou plus d'impayÃ©s cumulÃ©s.
- **Recettes** : enregistrement de tous les encaissements (mensualitÃ©s, inscriptions, Ã©vÃ©nements, dons) avec catÃ©gorisation et rapprochement.
- **DÃ©penses** : enregistrement des sorties (loyer, Ã©lectricitÃ©, fournitures, salaires, etc.) avec catÃ©gories standardisÃ©es.
- **Versements** : transferts vers la fondation ou le groupe scolaire (pour les Ã©coles affiliÃ©es Ã  un rÃ©seau).
- **Bons de caisse** : avances sur salaire, bons de transport, justifiÃ©s par piÃ¨ces.
- **Tableaux de bord financiers** : recettes vs dÃ©penses par mois, marge mensuelle, projection trÃ©sorerie.
- Export Excel de tous les rapports comptables pour transmission au cabinet comptable externe.

### 4.6 Module Paiement en ligne (paiement Mobile Money)

- Les directions peuvent demander un upgrade de plan via un formulaire.
- Le paiement est confirmÃ© par un webhook signÃ© HMAC qui active automatiquement le plan dans Firestore.
- Support des plans : DÃ©couverte (gratuit limitÃ©), Starter, Pro, Premium.
- Renouvellement automatique annuel possible.
- DÃ©sactivation auto en fin d'abonnement avec prÃ©avis.

### 4.7 Module Communication

- **Annonces publiques** : visibles par tous, y compris non-connectÃ©s, sur le portail public de l'Ã©cole.
- **Messages Ã©cole â†” parents** : sujet + corps, avec accusÃ© de lecture cÃ´tÃ© Ã©cole, et restrictions strictes (un parent ne peut Ã©crire que ses propres threads, jamais modifier ni supprimer).
- **Notifications push** : envoi ciblÃ© par rÃ´le ou par classe (rentrÃ©e, jour fÃ©riÃ©, alerte impayÃ©, etc.).
- **Messages SuperAdmin â†’ Ã©coles** : canal de diffusion descendante, avec niveaux info / important / critique. Les messages important/critique affichent un bandeau d'alerte qui ne disparaÃ®t qu'aprÃ¨s lecture explicite.
- **Cloche flottante** dans toute l'app pour signaler les nouveaux messages SuperAdmin.

### 4.8 Module Calendrier

- Ã‰vÃ©nements scolaires (rentrÃ©e, vacances, examens, journÃ©es culturelles).
- Vue mensuelle ou liste.
- Visible par tous les rÃ´les autorisÃ©s.

### 4.9 Module Recherche globale

- Barre de recherche transversale dans l'app : trouve un Ã©lÃ¨ve, un enseignant, un parent par nom, matricule, login, en quelques caractÃ¨res, toutes sections confondues.

### 4.10 Module Tableau de bord

- Vue synthÃ©tique pour la direction : effectifs par section, taux d'occupation par classe, recettes/dÃ©penses du mois, alertes impayÃ©s, Ã©vÃ©nements Ã  venir, derniÃ¨res notes saisies.
- Graphiques d'Ã©volution des effectifs et des recettes sur 12 mois glissants.
- GÃ©nÃ©ration de rapports mensuels au format PDF pour conseil d'administration.

### 4.11 Module Historique (audit log)

- Toutes les actions sensibles (crÃ©ation/suppression d'Ã©lÃ¨ve, paiement, modification de tarif, gÃ©nÃ©ration de salaires, suppression de note) sont loguÃ©es avec auteur, timestamp, dÃ©tails.
- Consultable par la direction et l'admin pour audit et rÃ©solution de litiges.

### 4.12 Module Examens

- CrÃ©ation de sessions d'examens internes (BEPC blanc, Bac blanc, compositions trimestrielles).
- Affectation des matiÃ¨res et coefficients.
- Saisie des notes et calcul automatique des rÃ©sultats.
- Production des relevÃ©s de notes et procÃ¨s-verbaux.

### 4.13 Module Tableau d'honneur

- Saisie manuelle ou automatique (basÃ©e sur la moyenne gÃ©nÃ©rale) des Ã©lÃ¨ves mÃ©ritants.
- Affichage public sur le portail Ã©cole avec photo.

### 4.14 Module Fondation / Groupe scolaire

- Pour les Ã©coles appartenant Ã  un groupe ou Ã  une fondation : gestion des membres du conseil, documents officiels, versements consolidÃ©s des Ã©tablissements affiliÃ©s.

### 4.15 Module Inscription publique

- Formulaire d'inscription d'une nouvelle Ã©cole accessible sur le portail principal d'EduGest.
- VÃ©rification anti-spam, normalisation, gÃ©nÃ©ration automatique du `schoolId` et des comptes par dÃ©faut (direction, admin, comptable selon configuration).
- GÃ©nÃ©ration de mots de passe initiaux sÃ©curisÃ©s (entropy â‰¥ 128 bits) communiquÃ©s Ã  l'Ã©cole.
- Synchronisation immÃ©diate vers la collection publique `ecoles_public` pour visibilitÃ©.

### 4.16 Module Portail Public

- Chaque Ã©cole a son URL publique (`/ecole/{slug}`) avec :
  - Logo et couleurs personnalisÃ©s
  - Slogan et texte d'accueil
  - Liste des annonces rÃ©centes
  - Tableau d'honneur
  - CoordonnÃ©es et localisation
- Aucune authentification requise pour la consultation, idÃ©al pour les parents prospects.

### 4.17 Module Portail Parent

- Vue dÃ©diÃ©e aux parents avec :
  - Bulletins de leurs enfants en lecture seule
  - Statut des mensualitÃ©s et historique des paiements
  - Calendrier scolaire
  - Annonces de l'Ã©cole
  - Messagerie pour contacter l'administration
- Un parent peut Ãªtre liÃ© Ã  plusieurs enfants. Le systÃ¨me dÃ©tecte automatiquement les foyers identiques (mÃªme tuteur + filiation + contact) et fusionne les comptes pour Ã©viter les doublons : un seul login pour tous les enfants d'une mÃªme famille.

### 4.18 Module Portail Enseignant

- Vue dÃ©diÃ©e aux enseignants avec :
  - Leurs classes et matiÃ¨res uniquement
  - Saisie de notes restreinte Ã  leur pÃ©rimÃ¨tre
  - Saisie d'absences pour leurs cours
  - Annonces internes
  - Pas d'accÃ¨s aux donnÃ©es financiÃ¨res

### 4.19 Module SuperAdmin

- Console centrale pour le propriÃ©taire de la plateforme :
  - Liste de toutes les Ã©coles avec statut, plan, dernier paiement
  - Activation / dÃ©sactivation manuelle de plans
  - Communications transversales (broadcast Ã  toutes les Ã©coles ou Ã  un sous-ensemble)
  - Supervision des demandes d'upgrade
  - Statistiques globales d'usage
  - Gestion des super-admins eux-mÃªmes
- Authentification renforcÃ©e (compte sÃ©parÃ©, rate limit strict 5 tentatives par heure, login dÃ©diÃ©).

---

## 5. SÃ©curitÃ© et conformitÃ©

EduGest a fait l'objet d'un travail de durcissement systÃ©matique. Les mesures en place incluent :

### 5.1 Authentification
- Tokens JWT Firebase Ã  durÃ©e limitÃ©e (1h) avec refresh automatique.
- Custom claims signÃ©s cÃ´tÃ© serveur (`role`, `schoolId`) propagÃ©s dans les rÃ¨gles Firestore.
- bcrypt 10 rounds pour les hashes de mots de passe (rÃ©sistant au brute force GPU).
- Mot de passe initial obligatoire Ã  8 caractÃ¨res minimum, changement forcÃ© Ã  la premiÃ¨re connexion (`premiereCo`).

### 5.2 Autorisation
- RÃ¨gles Firestore avec **whitelist explicite** : chaque collection est listÃ©e nommÃ©ment avec ses rÃ¨gles d'accÃ¨s. Toute collection non whitelistÃ©e est refusÃ©e en lecture **et** en Ã©criture.
- Validation du schÃ©ma Ã  la crÃ©ation des comptes (clÃ©s autorisÃ©es, longueur min/max, format login).
- Restriction stricte des Ã©critures parents : un parent ne peut crÃ©er que ses propres messages (`expediteur === "parent"`, sujet 1-200 caractÃ¨res, corps 1-5000 caractÃ¨res), jamais modifier ni supprimer.
- Cloisonnement total entre Ã©coles (un user d'Ã©cole A ne peut jamais lire les donnÃ©es d'Ã©cole B).

### 5.3 Protection des endpoints
- Rate limiting Firestore-based sur login (10/15min), inscription Ã©cole (5/24h), super-admin (5/h).
- VÃ©rification CORS same-origin pour toutes les API.
- Validation stricte des inputs (longueur, format, type) avant tout accÃ¨s DB.
- Les endpoints sensibles exigent un Bearer token Firebase valide + vÃ©rification de rÃ´le + vÃ©rification de scope Ã©cole.

### 5.4 Protection navigateur
- **Content Security Policy** stricte : `script-src 'self'` (pas de eval, pas de inline), `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`.
- HSTS 2 ans avec `includeSubDomains` et `preload`.
- X-Frame-Options DENY (pas d'embedding possible dans un iframe tiers).
- X-Content-Type-Options nosniff.
- Permissions-Policy restrictive (geo, micro, camÃ©ra dÃ©sactivÃ©s ; payment limitÃ© Ã  paiement Mobile Money).

### 5.5 Webhook de paiement
- VÃ©rification HMAC de la signature paiement Mobile Money sur chaque notification.
- Idempotency key pour Ã©viter les doubles activations.

### 5.6 Audit
- Toutes les actions sensibles loguÃ©es dans `historique` avec auteur, timestamp, dÃ©tails.
- SuperAdmin a accÃ¨s Ã  un journal global des paiements et des connexions suspectes.

### 5.7 ConformitÃ©
- Architecture compatible RGPD-like (le schoolId cloisonne les donnÃ©es, droit Ã  l'effacement implÃ©mentable via suppression de la sous-arborescence).
- Mots de passe jamais stockÃ©s en clair, jamais loggÃ©s.
- Tokens jamais stockÃ©s cÃ´tÃ© serveur (stateless JWT).

Le document `docs/security-architecture.md` dÃ©taille la dÃ©fense en profondeur et le modÃ¨le de menace.

---

## 6. ModÃ¨le Ã©conomique

### 6.1 Structure tarifaire envisagÃ©e (Ã  valider par les premiers tests marchÃ©)

| Plan | Cible | Prix mensuel (GNF) | Ã‰lÃ¨ves max | Modules inclus |
|---|---|---|---|---|
| DÃ©couverte | Test gratuit 30 jours | 0 | 50 | Ã‰lÃ¨ves, Notes, Bulletins basiques |
| Starter | Petite Ã©cole (< 200 Ã©lÃ¨ves) | 200 000 | 200 | + ComptabilitÃ©, Annonces, Parents |
| Pro | Ã‰cole moyenne (200-600 Ã©lÃ¨ves) | 500 000 | 600 | + Examens, Livrets, Push, Multi-section |
| Premium | Grande Ã©cole / groupe (600+) | 1 000 000+ | IllimitÃ© | + Fondation, Multi-Ã©cole, IA, Support prioritaire |

Ã€ titre de rÃ©fÃ©rence : 1 USD â‰ˆ 8 600 GNF en 2026. Une Ã©cole de 300 Ã©lÃ¨ves payant 200 000 GNF/mois reprÃ©sente environ 23 USD/mois, soit ~660 GNF/Ã©lÃ¨ve â€” nÃ©gligeable face au coÃ»t d'un seul cahier de notes perdu.

### 6.2 Acquisition

- DÃ©marchage direct des directions d'Ã©coles privÃ©es dans Conakry.
- Partenariat avec les fÃ©dÃ©rations d'Ã©coles privÃ©es (FENEEPEG, FENECOPE en GuinÃ©e).
- DÃ©mos gratuites en prÃ©sentiel.
- Programme de parrainage (Ã©cole qui amÃ¨ne une Ã©cole : 1 mois offert).
- PrÃ©sence physique aux salons Ã©ducation (Salon de l'Ã‰ducation et de la Formation de Conakry).

### 6.3 RÃ©tention

- Onboarding accompagnÃ© lors des 30 premiers jours (coaching de 2-3 sessions).
- Hotline WhatsApp/tÃ©lÃ©phone en franÃ§ais pour le support.
- Mises Ã  jour fonctionnelles rÃ©guliÃ¨res (signal de produit vivant).
- Newsletter mensuelle Ã  la direction sur les nouveautÃ©s.

### 6.4 Projection Ã  24 mois (scÃ©nario mÃ©dian)

| Mois | Ã‰coles | MRR (GNF) | MRR (USD) |
|---|---|---|---|
| M3 | 5 | 1 000 000 | 116 |
| M6 | 15 | 4 500 000 | 523 |
| M12 | 40 | 14 000 000 | 1 628 |
| M18 | 80 | 30 000 000 | 3 488 |
| M24 | 150 | 60 000 000 | 6 977 |

Ã€ 150 Ã©coles, l'ARR (revenus annualisÃ©s) atteint ~85 000 USD. Avec une Ã©quipe lean de 2-3 personnes (dev + commercial + support), la marge nette projetÃ©e est â‰¥ 50%.

---

## 7. MarchÃ© et positionnement

### 7.1 Taille du marchÃ© en GuinÃ©e

- Population scolarisÃ©e : ~3,5 millions d'Ã©lÃ¨ves (2024).
- Ã‰tablissements : ~13 000 Ã©coles primaires, ~2 500 collÃ¨ges, ~1 200 lycÃ©es.
- PrivÃ© / public : ~25% des Ã©lÃ¨ves en privÃ© en zone urbaine (â‰ˆ 200 000 Ã©lÃ¨ves dans le secteur privÃ© urbain, principalement Conakry, Kindia, Kankan, LabÃ©).
- Cible adressable rÃ©aliste sur 5 ans : 2 000 Ã©coles privÃ©es payantes.
- MarchÃ© total adressable (TAM) GuinÃ©e : ~4 800 USD/mois Ã— 2 000 = 9,6 M USD/an. SAM cible 5 ans : 1,5 Ã  2 M USD ARR.

### 7.2 Expansion rÃ©gionale

L'architecture multi-tenant + l'adaptation aux mobile money locaux permettent un dÃ©ploiement en :
- **CÃ´te d'Ivoire** (15M scolarisÃ©s, mobile money mature, Ã©coles privÃ©es nombreuses)
- **SÃ©nÃ©gal** (forte tradition d'Ã©coles privÃ©es, infrastructure numÃ©rique solide)
- **Mali, Burkina Faso, BÃ©nin, Togo** (marchÃ©s similaires Ã  la GuinÃ©e en taille et maturitÃ©)
- **Cameroun, RDC** (gros volumes, complexitÃ© plus Ã©levÃ©e mais ARR potentiel Ã©norme)

Le passage Ã  un nouveau pays se fait essentiellement par : ajout des classes locales, intÃ©gration d'un opÃ©rateur mobile money local (Wave au SÃ©nÃ©gal, MTN MoMo Cameroun, etc.), traduction marketing si nÃ©cessaire.

### 7.3 Concurrence

- **Pronote / Ã‰cole Directe** : non adaptÃ©s Afrique francophone, pas de mobile money, prix en euros, support distant. PrÃ©sents marginalement dans les Ã©coles internationales.
- **Solutions locales artisanales** : gÃ©nÃ©ralement des fichiers Excel ou des logiciels desktop sans cloud, sans communication parents, sans paiement intÃ©grÃ©. Faible barriÃ¨re Ã  concurrencer.
- **Solutions africaines gÃ©nÃ©ralistes** (Mboalab, EdTech Africa) : peu spÃ©cialisÃ©es scolaire, pas multi-tenant, peu de traction rÃ©elle.
- **Risque entrant** : un Pronote francisÃ© pour l'Afrique (peu probable car peu rentable pour eux), ou un nouvel entrant africain bien capitalisÃ© (suivre Vodacom, Orange Foundation, CFA EdTech).

EduGest a actuellement une **fenÃªtre de 18-24 mois** pour s'imposer comme standard avant qu'un acteur capitalisÃ© ne tente l'entrÃ©e.

### 7.4 Avantages concurrentiels durables

1. **SpÃ©cialisation locale** : seul produit conÃ§u nativement pour le systÃ¨me Ã©ducatif guinÃ©en / ouest-africain.
2. **Mobile money intÃ©grÃ©** : levier d'adoption massif, indispensable et difficile Ã  ajouter rÃ©tro-activement par un concurrent.
3. **Multi-tenant + multi-Ã©cole** : permet aux groupes scolaires (fondations, congrÃ©gations) de centraliser sans surcoÃ»t.
4. **PWA offline** : fonctionne dans les zones Ã  connexion intermittente, lÃ  oÃ¹ les concurrents desktop ou full-cloud Ã©chouent.
5. **ModÃ¨le freemium** : test gratuit 30 jours sans CB, levÃ©e d'objection forte.
6. **Support en franÃ§ais + identitÃ© africaine** : crÃ©dibilitÃ© culturelle vs solutions importÃ©es.

---

## 8. Roadmap produit

### 8.1 Court terme (3 mois)

- **Module SMS de masse** : envoi aux parents (rappel impayÃ©, absence, rÃ©sultats) via passerelle SMS locale (Orange Guinea SMS API ou Africa's Talking). Cas d'usage critique car de nombreux parents n'ont pas de smartphone.
- **Application mobile parent native** (Capacitor sur le code React existant ou React Native) pour Play Store et App Store.
- **Mode hors-ligne complet** : permettre la saisie de notes/absences sans connexion, synchronisation au retour rÃ©seau (Firestore offline persistence + queue locale).
- **GÃ©nÃ©ration IA des apprÃ©ciations de bulletin** via Anthropic Claude API : l'enseignant Ã©crit 3 mots-clÃ©s, l'IA gÃ©nÃ¨re une apprÃ©ciation rÃ©digÃ©e. Ã‰conomie de temps massive en pÃ©riode de bulletin.
- **Plan tarifaire en GNF affichÃ©** dans l'UI (actuellement les plans sont prÃªts mais l'UX d'achat doit Ãªtre finalisÃ©e).

### 8.2 Moyen terme (6-12 mois)

- **Module BibliothÃ¨que** : catalogue des livres, prÃªts/retours, abonnements Ã©lÃ¨ves.
- **Module Cantine** : gestion des tickets repas, abonnements mensuels, facturation sÃ©parÃ©e des mensualitÃ©s.
- **Module Transport scolaire** : circuits, abonnements, suivi des trajets (option GPS pour vÃ©hicules Ã©quipÃ©s).
- **Module Suivi mÃ©dical** : fiche mÃ©dicale Ã©lÃ¨ve, vaccinations, allergies, traitements en cours, accÃ¨s infirmerie.
- **Examens nationaux** : prÃ©paration BEPC, BAC avec banque d'annales, examens blancs, statistiques de performance.
- **Multi-langue** : arabe pour les Ã©coles bilingues franco-arabes, anglais pour anticiper l'expansion en Afrique anglophone.
- **Marketplace de contenus pÃ©dagogiques** : enseignants vendent leurs cours / supports Ã  d'autres Ã©coles (revenu partagÃ© EduGest 15%).
- **API publique** : permet Ã  des partenaires (cabinets comptables, ministÃ¨re de l'Ã©ducation) de consommer les donnÃ©es autorisÃ©es.

### 8.3 Long terme (12-36 mois)

- **Plateforme LMS intÃ©grÃ©e** : cours en ligne, devoirs Ã  rendre numÃ©riquement, classe virtuelle (intÃ©gration Jitsi ou Whereby).
- **IA pÃ©dagogique avancÃ©e** : dÃ©tection prÃ©coce de dÃ©crochage scolaire (analyse notes + absences + comportement), recommandations personnalisÃ©es par Ã©lÃ¨ve, gÃ©nÃ©ration de plans de remÃ©diation.
- **Orientation post-bac** : module dÃ©diÃ© aux Ã©lÃ¨ves de Terminale, avec base de donnÃ©es universitaires (GuinÃ©e, Maroc, SÃ©nÃ©gal, France) et coaching IA.
- **Suivi compÃ©tences** (CECRL et approche par compÃ©tences ministÃ¨re) : transition progressive du systÃ¨me notation pure vers l'Ã©valuation par compÃ©tences.
- **IntÃ©gration ministÃ¨re de l'Ã‰ducation** : remontÃ©e automatique des effectifs et rÃ©sultats, Ã©vite Ã  chaque Ã©cole de produire ses statistiques manuellement.
- **FonctionnalitÃ©s banques** : prÃªts scolaires aux parents, paiements Ã©chelonnÃ©s financÃ©s, partenariat banques locales.
- **Ã‰dition mobile native iOS + Android complÃ¨te** (pas juste parent) avec sync Firebase, offline, push, Ã©quivalente Ã  la version web.
- **Support B2G** : vente de la plateforme Ã  des collectivitÃ©s/municipalitÃ©s pour gÃ©rer toutes leurs Ã©coles publiques.

---

## 9. PotentialitÃ©s stratÃ©giques

### 9.1 Effets de rÃ©seau Ã  exploiter

- **Transferts inter-Ã©coles** : dÃ©jÃ  implÃ©mentÃ© techniquement. Plus il y a d'Ã©coles sur EduGest, plus le transfert d'un Ã©lÃ¨ve devient fluide. Les parents prÃ©fÃ¨rent les Ã©coles qui sont sur la plateforme parce que c'est plus simple en cas de dÃ©mÃ©nagement.
- **RÃ©putation publique** : le portail public, le tableau d'honneur, les annonces deviennent un canal marketing pour l'Ã©cole elle-mÃªme. Plus EduGest est utilisÃ©, plus les Ã©coles ont intÃ©rÃªt Ã  y Ãªtre pour ne pas paraÃ®tre en retard.
- **DonnÃ©es agrÃ©gÃ©es sectorielles** : Ã  l'Ã©chelle, EduGest peut publier des benchmarks anonymes (taux de rÃ©ussite par section, Ã©volution des effectifs, salaires moyens) qui deviennent une rÃ©fÃ©rence pour le secteur â€” produit dÃ©rivÃ© monÃ©tisable.

### 9.2 Verticaux Ã  long terme

1. **EduGest Banking** : compte courant scolaire, prÃªt mensualitÃ©s, partenariat banque pour le compte d'opÃ©rations Ã©cole.
2. **EduGest Insurance** : assurance scolaire Ã©lÃ¨ves, assurance responsabilitÃ© civile Ã©cole, vendue en marketplace.
3. **EduGest Recruitment** : place de marchÃ© des enseignants, vÃ©rification antÃ©cÃ©dents, formation continue en ligne.
4. **EduGest Capital** : fond d'investissement pour la modernisation des Ã©coles (infrastructure, Ã©quipement IT, mobilier), remboursÃ© sur les revenus.
5. **EduGest Books** : Ã©dition numÃ©rique africaine partagÃ©e, manuels conformes programmes nationaux disponibles dans la plateforme.

### 9.3 LevÃ©e de fonds envisageable

Ã€ partir de M18 (~80 Ã©coles, 30 M GNF MRR â‰ˆ 3 500 USD MRR â‰ˆ 42 000 USD ARR), un tour de seed Ã  500K USD - 1M USD est crÃ©dible auprÃ¨s de fonds spÃ©cialisÃ©s Afrique :
- **Partech Africa**
- **Norrsken22**
- **Janngo Capital**
- **Catalyst Fund**
- **TLcom Capital**
- **CRE Venture Capital**

Les arguments de pitch : marchÃ© Ã©norme et sous-Ã©quipÃ©, traction prouvÃ©e, rÃ©tention probablement excellente (un logiciel scolaire ne se change pas tous les ans), Ã©quipe locale crÃ©dible, expansion rÃ©gionale claire.

### 9.4 Acquisition stratÃ©gique potentielle

Ã€ terme, des acquÃ©reurs naturels sont :
- **Orange Digital Education** ou Ã©quivalents tÃ©lÃ©coms cherchant Ã  diversifier au-delÃ  du mobile money.
- **Groupes Ã©ducatifs panafricains** (groupe Yango, BAY Group, ou nouveaux entrants) en consolidation.
- **Acteurs internationaux d'EdTech** entrant en Afrique francophone (Coursera, Pearson, Holberton).

Une valorisation de 5x Ã  10x ARR n'est pas irrÃ©aliste pour un SaaS sectoriel avec rÃ©tention forte. Ã€ 1M USD ARR, sortie potentielle 5-10M USD.

---

## 10. Risques et dÃ©fis

### 10.1 Risques techniques

- **DÃ©pendance Firebase** : si Google augmente fortement les prix ou modifie ses CGU, l'impact serait majeur. **Mitigation** : architecture hexagonale partielle (les modules mÃ©tier ne dÃ©pendent pas directement de Firestore), migration possible vers Supabase ou Postgres self-hosted en 1-2 mois.
- **Limites Vercel Hobby (12 fonctions)** : dÃ©jÃ  rencontrÃ©, mitigÃ© par consolidation en routers d'actions. **Plan B** : Pro Ã  20 USD/mois si croissance.
- **Latence rÃ©seau GuinÃ©e** : mÃ©diocre dans certaines zones rurales. **Mitigation** : PWA + offline persistence, CDN Cloudflare envisageable.

### 10.2 Risques produit

- **Charge cognitive** : EduGest fait beaucoup de choses, le risque d'overwhelm est rÃ©el. **Mitigation** : onboarding progressif, modules dÃ©sactivables, UI Ã©purÃ©e par dÃ©faut avec activation Ã  la demande.
- **Imports massifs Excel** : dÃ©jÃ  identifiÃ© un bug de dÃ©connexion lors d'imports premiÃ¨re annÃ©e (en cours d'investigation). **Mitigation** : observabilitÃ© renforcÃ©e, retry automatique, queue offline.

### 10.3 Risques marchÃ©

- **Pouvoir d'achat** : les Ã©coles privÃ©es guinÃ©ennes ont des marges fragiles. **Mitigation** : tarification en GNF, paiement en mobile money, plan DÃ©couverte gratuit pour acquÃ©rir la confiance.
- **Inertie des directions** : changer d'outil est difficile pour un directeur de 60 ans. **Mitigation** : dÃ©mos en prÃ©sentiel, accompagnement humain en franÃ§ais.
- **ConnectivitÃ© dÃ©gradÃ©e en saison des pluies** : la 4G chute en zone urbaine, certaines zones perdent le rÃ©seau. **Mitigation** : mode offline dÃ©jÃ  partiellement prÃ©sent, Ã  Ã©tendre.

### 10.4 Risques rÃ©glementaires

- **Protection donnÃ©es mineurs** : les Ã©lÃ¨ves sont des mineurs. La lÃ©gislation en GuinÃ©e est embryonnaire, mais une mise Ã  niveau RGPD-like est saine. **Mitigation** : consentement parents explicite, droit Ã  l'oubli implÃ©mentÃ©.
- **FiscalitÃ© SaaS GuinÃ©e** : le statut TVA et IS sur les SaaS Ã©trangers est flou. **Mitigation** : domiciliation locale envisageable (Conakry SARL) pour clartÃ©.

### 10.5 Risques opÃ©rationnels

- **Bus factor 1** : actuellement dÃ©veloppÃ© par une seule personne. **Mitigation** : documenter, recruter un second dÃ©veloppeur dÃ¨s les premiÃ¨res recettes rÃ©currentes.
- **Support client en croissance** : 1 personne ne peut pas supporter 100 Ã©coles. **Mitigation** : recrutement support Ã  partir de M9, formation des Ã©coles "champions" comme relais communautaires.

---

## 11. Vision long terme

EduGest a la capacitÃ© de devenir, d'ici 2030, **l'infrastructure numÃ©rique de rÃ©fÃ©rence pour la gestion scolaire en Afrique francophone**, Ã  l'image de ce que Pronote a Ã©tÃ© pour le systÃ¨me franÃ§ais. Les conditions sont rÃ©unies :

- Un produit dÃ©jÃ  fonctionnel et dÃ©ployÃ©.
- Un fondateur local crÃ©dible.
- Un marchÃ© Ã©norme, sous-Ã©quipÃ©, en croissance dÃ©mographique forte.
- Aucun concurrent dominant.
- Un modÃ¨le Ã©conomique sain, encaissable en monnaie locale.
- Une architecture technique scalable sans rÃ©Ã©criture.

L'ambition rÃ©aliste Ã  5 ans :
- 5 000 Ã  10 000 Ã©coles utilisatrices.
- PrÃ©sence dans 5 pays minimum (GuinÃ©e, CÃ´te d'Ivoire, SÃ©nÃ©gal, Mali, Burkina Faso).
- 5 Ã  15 millions USD d'ARR.
- 30 Ã  60 personnes en Ã©quipe.
- Un statut de licorne EdTech africaine atteignable Ã  horizon 8-10 ans.

L'ambition culturelle, plus profonde : moderniser silencieusement la gestion de l'Ã©ducation africaine, rendre la scolaritÃ© plus transparente pour les parents, plus efficace pour les directions, plus juste pour les Ã©lÃ¨ves transfÃ©rÃ©s ou en difficultÃ©. Un outil banal, devenu indispensable, qui fait que personne ne se rappelle plus comment on faisait avant.

---

## Annexes

### A. Glossaire technique

- **Multi-tenant** : architecture oÃ¹ une seule instance logicielle sert plusieurs clients (Ã©coles) avec cloisonnement strict des donnÃ©es.
- **PWA (Progressive Web App)** : application web installable comme une app native, fonctionnant offline.
- **JWT (JSON Web Token)** : format standard de jeton d'authentification signÃ©.
- **Custom claims** : donnÃ©es personnalisÃ©es attachÃ©es Ã  un token Firebase (rÃ´le, Ã©cole).
- **Webhook HMAC** : notification serveur-Ã -serveur dont l'authenticitÃ© est vÃ©rifiÃ©e par signature cryptographique.
- **Idempotence** : propriÃ©tÃ© d'une opÃ©ration qui produit le mÃªme rÃ©sultat mÃªme si elle est exÃ©cutÃ©e plusieurs fois (essentiel pour les paiements).
- **Whitelist** : liste blanche, par opposition Ã  blacklist. En sÃ©curitÃ©, on autorise explicitement, on refuse par dÃ©faut.

### B. Liens internes

- `docs/security-architecture.md` â€” ModÃ¨le de menace et dÃ©fense en profondeur.
- `docs/operations-runbook.md` â€” ProcÃ©dures opÃ©rationnelles (dÃ©ploiement, incidents, restauration).
- `docs/functional-smoke-checklist.md` â€” Liste de vÃ©rifications pre-deploy.
- `docs/dossier-commercial.html` â€” PrÃ©sentation commerciale (clients).
- `docs/pitch-deck.html` â€” Pitch investisseurs.
- `docs/fiche-produit.html` â€” Fiche produit synthÃ©tique.

### C. Contacts

- Fondateur : Moustapha Bah â€” bahmoustapha657@gmail.com
- Repository : github.com/bahmoustapha657-cmd/citadelle (privÃ©)

---

*Document maintenu manuellement. DerniÃ¨re mise Ã  jour : avril 2026.*


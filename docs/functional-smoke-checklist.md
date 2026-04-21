# Recette Fonctionnelle Courte

Objectif: verifier rapidement qu'un refactor ou un correctif securite n'a pas casse les flux critiques.

## Pre-requis

- Deployer ou lancer une version construite avec `npm run build`
- Disposer au minimum de 4 comptes de test:
  - `direction` ou `admin`
  - `comptable`
  - `enseignant`
  - `parent`
- Avoir une ecole de test avec:
  - au moins un eleve primaire
  - au moins un eleve secondaire
  - au moins un paiement en historique
  - au moins un message parent

## Controle Auth

- Connexion avec un compte ecole valide
- Refus de connexion avec mauvais mot de passe
- Refus de connexion avec `schoolId` invalide
- Premiere connexion:
  - forcer le changement de mot de passe
  - verifier que le mot de passe est ensuite synchronise
- Deconnexion:
  - verifier le retour a l'ecran de connexion

## Controle Roles

- `admin`:
  - acces au tableau de bord
  - acces au panneau admin
  - acces aux parametres ecole
- `comptable`:
  - acces a la comptabilite
  - pas d'acces au panneau superadmin
- `enseignant`:
  - acces au portail enseignant
  - pas d'acces au shell admin
- `parent`:
  - acces au portail parent
  - impression du bulletin si disponible

## Controle Comptabilite

- Ajouter une recette
- Ajouter une depense
- Generer un recu de paiement
- Export Excel d'une vue comptable
- Import Excel d'eleves via le modele

## Controle Scolarite

- Ouvrir la section primaire
- Ouvrir la section secondaire
- Imprimer une liste de classe
- Exporter une liste d'eleves
- Generer un bulletin
- Generer des bulletins groupes

## Controle Transferts

- Generer un token de transfert
- Lire un token valide avec session autorisee
- Verifier qu'un token invalide est refuse
- Verifier qu'un transfert vers la meme ecole est refuse

## Controle Paiement

- Verifier qu'un webhook signe cree bien un paiement
- Verifier qu'un webhook duplique ne cree pas un second enregistrement

## Controle Final

- `npm run lint`
- `npm run test`
- `npm run build`

Validation recommandee: ne considerer la version "prete" que si la recette fonctionnelle et les 3 commandes ci-dessus sont vertes.

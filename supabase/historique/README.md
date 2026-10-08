# Archives SQL — NE JAMAIS REJOUER

Ces fichiers sont l'historique des scripts collés à la main dans l'éditeur SQL
de Supabase jusqu'au 2026-10-08. Ils sont gardés pour comprendre le
**pourquoi** des règles (leurs commentaires sont la meilleure documentation
de la sécurité d'EduGest) et parce que certains tests en vérifient le
contenu.

**Ils ne sont PLUS la référence.** La référence est `supabase/migrations/` :
la baseline (`20261008175200_baseline.sql`, schéma réel de la production
à cette date) puis les migrations suivantes.

⚠️ Rejouer un de ces fichiers en production peut ROUVRIR une faille :
`rls.sql` rejoué seul a déjà rendu tout le personnel capable de se promouvoir
direction (2026-09-25). Pour toute évolution : une nouvelle migration
(`npm run migration:nouvelle -- <nom>`, cf. `docs/migrations-sql.md`).

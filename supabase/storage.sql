-- ════════════════════════════════════════════════════════════════════════
--  EduGest — Stockage objet (photos, logos, documents)   [delta]
-- ════════════════════════════════════════════════════════════════════════
-- À exécuter UNE FOIS dans Supabase → SQL Editor. Idempotent.
--
-- POURQUOI : les photos d'élèves étaient stockées en base64 DANS la colonne
-- `eleves.photo`. À 3 000 élèves et ~100 ko par photo, la table pèserait
-- 300 Mo — au-delà du plan gratuit à elle seule — et chaque `select *` les
-- retéléchargerait toutes. Aucune école n'ayant encore de photo (0 sur 501
-- à La Citadelle), c'est le moment de brancher le stockage objet sans avoir
-- la moindre donnée à migrer.
--
-- Accessoirement, le chemin d'envoi visait encore FIREBASE Storage, resté en
-- place après la migration : une photo prise aujourd'hui partait vers un
-- projet qui n'est plus la production.
--
-- ── Choix : bucket PUBLIC, nom de fichier aléatoire ───────────────────────
-- C'est l'équivalent exact de ce que faisait Firebase, dont getDownloadURL()
-- renvoie une URL publique porteuse d'un jeton aléatoire. L'image reste donc
-- accessible à qui possède l'URL, mais celle-ci est indevinable (uuid).
-- Un bucket privé imposerait des URL signées à durée de vie limitée, donc de
-- régénérer chaque `<img src>` — à envisager si la confidentialité des
-- photos d'élèves devient une exigence formelle.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Écriture réservée au personnel, dans le dossier de SON école ───────────
-- Arborescence : <code_ecole>/<categorie>/<fichier>. Le premier segment est
-- comparé au code de l'école du compte : un comptable ne peut pas déposer
-- dans le dossier d'un autre établissement.
do $$
begin
  execute 'drop policy if exists photos_lecture on storage.objects';
  execute 'drop policy if exists photos_insert on storage.objects';
  execute 'drop policy if exists photos_update on storage.objects';
  execute 'drop policy if exists photos_delete on storage.objects';

  -- Lecture : le bucket est public, la policy couvre l'accès via l'API
  -- authentifiée (listing, download signé) sans élargir quoi que ce soit.
  execute $p$
    create policy photos_lecture on storage.objects for select to public
      using (bucket_id = 'photos')
  $p$;

  execute $p$
    create policy photos_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'photos'
        and is_staff()
        and (storage.foldername(name))[1]
            = (select e.code from ecoles e where e.id = auth_ecole_id())
      )
  $p$;

  execute $p$
    create policy photos_update on storage.objects for update to authenticated
      using (
        bucket_id = 'photos'
        and is_staff()
        and (storage.foldername(name))[1]
            = (select e.code from ecoles e where e.id = auth_ecole_id())
      )
  $p$;

  execute $p$
    create policy photos_delete on storage.objects for delete to authenticated
      using (
        bucket_id = 'photos'
        and is_staff()
        and (storage.foldername(name))[1]
            = (select e.code from ecoles e where e.id = auth_ecole_id())
      )
  $p$;
end $$;

-- Contrôle :
--   select id, public from storage.buckets where id = 'photos';
--   select policyname, cmd from pg_policies
--    where tablename = 'objects' and policyname like 'photos_%';

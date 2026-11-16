-- ADD : Caisse (quêtes, offrandes, dépenses) – à exécuter APRÈS schema.sql et 02_roles.sql, une seule fois
-- Aucun paiement en ligne : l'argent est encaissé physiquement, l'application enregistre seulement les montants.
-- Droits : lecture, ajout et modification pour les responsables et l'administrateur ; suppression pour l'administrateur seul.
-- Les serviteurs n'ont aucun accès à la caisse.
create table if not exists caisse(
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  sens text not null check (sens in ('entree','sortie')),
  categorie text not null,
  occasion text,
  libelle text,
  montant numeric(14,2) not null check (montant > 0),
  saisi_par text,
  modifie_par text,
  modifie_le timestamptz,
  created_at timestamptz default now());
create index if not exists caisse_date_idx on caisse(date);

alter table caisse enable row level security;
drop policy if exists "lire_caisse" on caisse;
drop policy if exists "ajouter_caisse" on caisse;
drop policy if exists "modifier_caisse" on caisse;
drop policy if exists "supprimer_caisse" on caisse;
create policy "lire_caisse" on caisse for select to authenticated using (is_resp());
create policy "ajouter_caisse" on caisse for insert to authenticated with check (is_resp());
create policy "modifier_caisse" on caisse for update to authenticated using (is_resp()) with check (is_resp());
create policy "supprimer_caisse" on caisse for delete to authenticated using (is_admin());

-- Date de dernière modification enregistrée par la base (non falsifiable depuis l'application)
create or replace function caisse_maj() returns trigger language plpgsql as $$
begin new.modifie_le := now(); return new; end $$;
drop trigger if exists trg_caisse_maj on caisse;
create trigger trg_caisse_maj before update on caisse for each row execute function caisse_maj();

-- Devise affichée dans l'application (modifiable ici si besoin)
insert into parametres values ('devise','FCFA') on conflict (cle) do nothing;

-- ADD – Suivi des membres (Âmes de Dieu) : à exécuter dans Supabase > SQL Editor
create table profiles(
  id uuid primary key references auth.users on delete cascade,
  username text unique not null, nom text,
  role text not null default 'serviteur' check (role in ('admin','responsable','serviteur')),
  actif boolean not null default false, created_at timestamptz default now());

create or replace function is_active() returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from profiles where id=auth.uid() and actif) $$;
create or replace function is_admin() returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from profiles where id=auth.uid() and actif and role='admin') $$;

-- Le tout premier compte créé devient administrateur actif. Les suivants sont inactifs tant qu'un admin ne les active pas.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare n int; begin
  select count(*) into n from profiles;
  insert into profiles(id,username,nom,role,actif)
  values(new.id, split_part(new.email,'@',1), split_part(new.email,'@',1), case when n=0 then 'admin' else 'serviteur' end, n=0);
  return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create table cellules(
  id uuid primary key default gen_random_uuid(), nom text not null, responsable text, lieu text,
  jour text, heure text, created_at timestamptz default now());

create sequence matricule_seq;
create table membres(
  id uuid primary key default gen_random_uuid(),
  matricule text unique default ('ADD-'||lpad(nextval('matricule_seq')::text,4,'0')),
  nom_prenoms text not null, sexe text check (sexe in ('M','F')), date_naissance date,
  telephone text, lieu_habitation text, lieu_travail text, photo_url text,
  date_integration date default current_date,
  nouveau_converti boolean default false, souhaite_membre boolean default false,
  baptise boolean default false, date_bapteme date,
  cellule_id uuid references cellules(id) on delete set null,
  consentement boolean default false, consentement_date date,
  archive boolean default false, archive_date date, created_at timestamptz default now());

create table reunions(
  id uuid primary key default gen_random_uuid(), type text not null check (type in ('culte','cellule')),
  date date not null, titre text, cellule_id uuid references cellules(id) on delete cascade,
  observation text, created_at timestamptz default now());

create table presences(
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references reunions(id) on delete cascade,
  membre_id uuid not null references membres(id) on delete cascade,
  statut text not null check (statut in ('present','absent','excuse')), observation text,
  unique(reunion_id, membre_id));

create table visites(
  id uuid primary key default gen_random_uuid(), membre_id uuid not null references membres(id) on delete cascade,
  date_visite date not null, motif text, lieu text, visiteur text, compte_rendu text, besoins text,
  actions text, prochaine_visite date, created_at timestamptz default now());

create table baptemes(
  id uuid primary key default gen_random_uuid(), membre_id uuid unique not null references membres(id) on delete cascade,
  statut text not null default 'selectionne' check (statut in ('selectionne','valide','ajourne','baptise')),
  date_decision date, observation text, date_prevue date, date_bapteme date, responsable text, lieu text,
  created_at timestamptz default now());

create table evenements(
  id uuid primary key default gen_random_uuid(), titre text not null, type text, date date not null,
  lieu text, description text, participants int, compte_rendu text, created_at timestamptz default now());

create table historique(
  id uuid primary key default gen_random_uuid(), membre_id uuid references membres(id) on delete cascade,
  action text, detail text, auteur text, created_at timestamptz default now());

create table parametres(cle text primary key, valeur text);
insert into parametres values ('nom_eglise','Âmes de Dieu'),('seuil_cultes','6'),('seuil_cellules','4'),('fenetre_jours','90'),('jours_actif','30');

-- Sécurité : seuls les comptes actifs accèdent aux données
alter table profiles enable row level security;
create policy "profiles_lecture" on profiles for select to authenticated using (id=auth.uid() or is_active());
create policy "profiles_admin" on profiles for update to authenticated using (is_admin()) with check (is_admin());
do $$ declare t text; begin
  foreach t in array array['membres','cellules','reunions','presences','visites','baptemes','evenements','historique','parametres'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "acces_%1$s" on %1$I for all to authenticated using (is_active()) with check (is_active())', t);
  end loop; end $$;

-- Photos des membres
insert into storage.buckets(id,name,public) values('photos','photos',true) on conflict do nothing;
create policy "photos_lecture" on storage.objects for select using (bucket_id='photos');
create policy "photos_ecriture" on storage.objects for all to authenticated
  using (bucket_id='photos' and is_active()) with check (bucket_id='photos' and is_active());

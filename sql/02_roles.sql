-- ADD : droits des rôles appliqués côté base (à exécuter APRÈS schema.sql, une seule fois)
-- Serviteur : saisie (membres, présences, visites...) mais ni suppression, ni archivage, ni décisions de baptême, ni paramètres.
-- Responsable / Administrateur : tout, sauf la gestion des utilisateurs (administrateur seulement).
create or replace function is_resp() returns boolean language sql security definer stable set search_path=public as
$$ select exists(select 1 from profiles where id=auth.uid() and actif and role in ('admin','responsable')) $$;

do $$ declare t text; begin
  foreach t in array array['membres','cellules','reunions','presences','visites','evenements','historique'] loop
    execute format('drop policy if exists "acces_%1$s" on %1$I', t);
    execute format('create policy "lire_%1$s" on %1$I for select to authenticated using (is_active())', t);
    execute format('create policy "ajouter_%1$s" on %1$I for insert to authenticated with check (is_active())', t);
    execute format('create policy "modifier_%1$s" on %1$I for update to authenticated using (is_active()) with check (is_active())', t);
    execute format('create policy "supprimer_%1$s" on %1$I for delete to authenticated using (is_resp())', t);
  end loop;
  foreach t in array array['baptemes','parametres'] loop
    execute format('drop policy if exists "acces_%1$s" on %1$I', t);
    execute format('create policy "lire_%1$s" on %1$I for select to authenticated using (is_active())', t);
    execute format('create policy "ecrire_%1$s" on %1$I for all to authenticated using (is_resp()) with check (is_resp())', t);
  end loop;
end $$;

-- L'archivage d'une fiche est réservé aux responsables
create or replace function bloquer_archive() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.archive is distinct from old.archive and not is_resp() then
    raise exception 'Seuls les responsables peuvent archiver ou restaurer une fiche.';
  end if;
  return new;
end $$;
drop trigger if exists trg_bloquer_archive on membres;
create trigger trg_bloquer_archive before update on membres for each row execute function bloquer_archive();

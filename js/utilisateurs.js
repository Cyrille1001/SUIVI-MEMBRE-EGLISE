boot('utilisateurs', 'Utilisateurs', async () => { if (!isAdmin()) { location.href = 'dashboard.html'; return; } await loadUsers(); });

async function loadUsers() {
  await run(async () => {
    const { data, error } = await sb.from('profiles').select('*').order('created_at'); if (error) throw error;
    const R = { admin: 'Administrateur', responsable: 'Responsable', serviteur: 'Serviteur' };
    $('#pane-usr').innerHTML = `<div class="bar"><button class="btn" id="nu">＋ Nouvel utilisateur</button></div><div class="panel">${table(['Utilisateur', 'Nom', 'Rôle', 'Statut', ''], data.map(u => [esc(u.username), esc(u.nom || ''), R[u.role], u.actif ? badge('Actif', 'ok') : badge('Désactivé', 'b'),
      u.id === ME.id ? '<small>Vous</small>' : `<button class="btn sm ghost" onclick="editUser('${u.id}')">Modifier</button>`]), 'Aucun utilisateur.')}</div>
      <p style="color:var(--mut)">Administrateur : tout. Responsable : tout sauf les utilisateurs. Serviteur : saisie (membres, présences, visites) sans archivage ni décisions de baptême. Pour réinitialiser le mot de passe d'un utilisateur, passez par Supabase > Authentication.</p>`;
    window._users = data; $('#nu').onclick = newUser;
  });
}
function newUser() {
  const b = openModal('Nouvel utilisateur', `<label class="f"><span>Nom d'utilisateur *</span><input name="username" autocapitalize="none"></label><label class="f"><span>Nom complet</span><input name="nom"></label>
    <label class="f"><span>Rôle</span><select name="role"><option value="serviteur">Serviteur</option><option value="responsable">Responsable</option><option value="admin">Administrateur</option></select></label>
    <label class="f"><span>Mot de passe (8 caractères minimum) *</span><input type="password" name="password" autocomplete="new-password"></label><div class="foot"><span></span><button class="btn" id="ok">Créer</button></div>`);
  $('#ok', b).onclick = () => run(async () => { const d = formData(b), u = (d.username || '').toLowerCase().replace(/\s/g, '');
    if (!/^[a-z0-9._-]{3,}$/.test(u)) return toast("Nom d'utilisateur : 3 caractères minimum, lettres/chiffres.", 'bad'); if ((d.password || '').length < 8) return toast('Mot de passe : 8 caractères minimum.', 'bad');
    const tmp = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const r = await tmp.auth.signUp({ email: u + '@' + CFG.EMAIL_DOMAIN, password: d.password }); if (r.error) throw r.error;
    const { error } = await sb.from('profiles').update({ nom: d.nom || u, role: d.role, actif: true }).eq('id', r.data.user.id); if (error) throw error;
    closeModal(); toast('Utilisateur créé.'); loadUsers(); });
}
function editUser(id) {
  const u = window._users.find(x => x.id === id);
  const b = openModal(`Modifier ${esc(u.username)}`, `<label class="f"><span>Nom complet</span><input name="nom"></label><label class="f"><span>Rôle</span><select name="role"><option value="serviteur">Serviteur</option><option value="responsable">Responsable</option><option value="admin">Administrateur</option></select></label>
    <label class="f chk"><input type="checkbox" name="actif"> Compte actif</label><div class="foot"><span></span><button class="btn" id="ok">Enregistrer</button></div>`);
  fillForm(b, u);
  $('#ok', b).onclick = () => run(async () => { const { error } = await sb.from('profiles').update(formData(b)).eq('id', id); if (error) throw error; closeModal(); toast('Utilisateur mis à jour.'); loadUsers(); });
}

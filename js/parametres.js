boot('parametres', 'Paramètres', async () => { compte(); if (isResp()) { await eglise(); sauvegarde(); } });

function compte() {
  $('#pane-cpt').innerHTML = `<div class="panel" style="max-width:460px"><p>Connecté en tant que <b>${esc(ME.username)}</b> (${esc(ME.role)})</p>
    <label class="f"><span>Nouveau mot de passe (8 caractères minimum)</span><input type="password" id="np" autocomplete="new-password"></label>
    <label class="f"><span>Confirmer</span><input type="password" id="np2" autocomplete="new-password"></label><button class="btn" id="chg">Changer le mot de passe</button></div>`;
  $('#chg').onclick = () => run(async () => { const a = $('#np').value; if (a.length < 8) return toast('8 caractères minimum.', 'bad'); if (a !== $('#np2').value) return toast('Les mots de passe ne correspondent pas.', 'bad');
    const { error } = await sb.auth.updateUser({ password: a }); if (error) throw error; $('#np').value = $('#np2').value = ''; toast('Mot de passe modifié.'); });
}

async function eglise() {
  const P = await getParam();
  $('#pane-egl').innerHTML = `<div class="panel" style="max-width:640px"><h3>Informations de l'église</h3>
    <label class="f"><span>Nom</span><input name="nom_eglise"></label><div class="fg"><label class="f"><span>Téléphone</span><input name="telephone"></label><label class="f"><span>Adresse</span><input name="adresse"></label></div>
    <h3 style="margin-top:16px">Règles de suivi</h3><p style="color:var(--mut);margin-top:0">Ces valeurs pilotent les candidats au baptême, les membres « réguliers » et les membres « à relancer ».</p>
    <div class="fg"><label class="f"><span>Présences minimum aux cultes</span><input type="number" min="0" name="seuil_cultes"></label><label class="f"><span>Présences minimum aux cellules</span><input type="number" min="0" name="seuil_cellules"></label>
    <label class="f"><span>Sur combien de jours (régularité)</span><input type="number" min="7" name="fenetre_jours"></label><label class="f"><span>Sans présence depuis (jours) = à relancer</span><input type="number" min="7" name="jours_actif"></label></div>
    <button class="btn" id="sv">Enregistrer</button></div>`;
  fillForm($('#pane-egl'), P);
  $('#sv').onclick = () => run(async () => { const d = formData($('#pane-egl'));
    const { error } = await sb.from('parametres').upsert(Object.entries(d).map(([cle, valeur]) => ({ cle, valeur: String(valeur ?? '') })), { onConflict: 'cle' }); if (error) throw error; toast('Paramètres enregistrés.'); });
}


function sauvegarde() {
  $('#pane-sav').innerHTML = `<div class="panel" style="max-width:640px"><h3>Sauvegarde des données</h3>
    <p style="color:var(--mut);margin-top:0">Télécharge toutes les données (membres, présences, visites, baptêmes, événements…) dans un seul fichier. À faire régulièrement, par exemple chaque mois. Ce fichier contient des informations personnelles : conservez-le en lieu sûr.</p>
    <button class="btn" id="bk" data-ico="download">Télécharger la sauvegarde</button></div>`;
  decorate();
  $('#bk').onclick = () => run(async () => {
    const out = { application: 'ADD Âmes de Dieu', date: new Date().toISOString(), tables: {} };
    for (const t of ['membres', 'cellules', 'reunions', 'presences', 'visites', 'baptemes', 'evenements', 'historique', 'parametres'])
      out.tables[t] = await fetchAll(() => sb.from(t).select('*').order(t === 'parametres' ? 'cle' : 'id'));
    downloadBlob(`sauvegarde-add-${today()}.json`, new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
    toast('Sauvegarde téléchargée.');
  });
}

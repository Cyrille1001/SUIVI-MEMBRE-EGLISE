let MEM = [], VIS = [];
const MOTIFS = ['Maladie', 'Absence prolongée', 'Difficultés familiales', 'Encouragement spirituel', 'Prise de nouvelles', 'Nouveau membre', 'Autre'];
boot('visites', 'Visites', async () => {
  await load(); draw(); $('#add').onclick = () => edit();
  const m = new URLSearchParams(location.search).get('membre'); if (m) edit(null, m);
});
async function load() {
  [MEM, VIS] = await Promise.all([
    fetchAll(() => sb.from('membres').select('id,matricule,nom_prenoms,telephone,date_integration').eq('archive', false).order('nom_prenoms').order('id')),
    fetchAll(() => sb.from('visites').select('*').order('date_visite', { ascending: false }).order('id'))]);
}
const nm = id => MEM.find(m => m.id === id);
function draw() {
  $('#pane-his').innerHTML = `<div class="bar"><input id="vq" placeholder="Rechercher un membre…"><select id="vm"><option value="">Tous les motifs</option>${MOTIFS.map(m => `<option>${m}</option>`).join('')}</select></div><div class="panel" id="vl"></div>`;
  const list = () => { const q = $('#vq').value.toLowerCase(), mo = $('#vm').value;
    $('#vl').innerHTML = table(['Date', 'Membre', 'Motif', 'Lieu', 'Compte rendu', 'Besoins', 'Actions à mener', 'Prochaine', ''],
      VIS.filter(v => (!mo || v.motif === mo) && (nm(v.membre_id)?.nom_prenoms || '').toLowerCase().includes(q)).map(v => [fmtDate(v.date_visite), nm(v.membre_id) ? lienMembre(nm(v.membre_id)) : '(archivé)', esc(v.motif || ''), esc(v.lieu || ''), esc(v.compte_rendu || ''), esc(v.besoins || ''), esc(v.actions || ''), fmtDate(v.prochaine_visite),
        `<button class="btn sm ghost" onclick="edit('${v.id}')">Modifier</button>` + (isResp() ? `<button class="btn sm red" onclick="del('${v.id}')">✕</button>` : '')]), 'Aucune visite enregistrée.'); };
  $('#vq').oninput = $('#vm').onchange = list; list();

}
function edit(id, membreId) {
  const v = id ? VIS.find(x => x.id === id) : { date_visite: today(), membre_id: membreId || '' };
  const b = openModal(id ? 'Modifier la visite' : 'Nouvelle visite', `<div class="fg">
    <label class="f full"><span>Membre visité *</span><select name="membre_id"><option value="">Choisir…</option>${MEM.map(m => `<option value="${m.id}">${esc(m.nom_prenoms)} (${esc(m.matricule)})</option>`).join('')}</select></label>
    <label class="f"><span>Date de la visite *</span><input type="date" name="date_visite"></label>
    <label class="f"><span>Motif</span><select name="motif"><option value="">—</option>${MOTIFS.map(m => `<option>${m}</option>`).join('')}</select></label>
    <label class="f"><span>Lieu de la visite</span><input name="lieu"></label><label class="f"><span>Visiteur(s)</span><input name="visiteur"></label>
    <label class="f full"><span>Compte rendu</span><textarea name="compte_rendu"></textarea></label><label class="f full"><span>Besoins identifiés</span><textarea name="besoins"></textarea></label>
    <label class="f full"><span>Actions à entreprendre</span><textarea name="actions"></textarea></label><label class="f"><span>Date de la prochaine visite</span><input type="date" name="prochaine_visite"></label></div>
    <div class="foot"><span></span><button class="btn" id="ok">Enregistrer</button></div>`, { wide: true });
  fillForm(b, v);
  $('#ok', b).onclick = () => run(async () => { const d = formData(b);
    if (!d.membre_id || !d.date_visite) return toast('Choisissez le membre et la date.', 'bad');
    const { error } = id ? await sb.from('visites').update(d).eq('id', id) : await sb.from('visites').insert(d); if (error) throw error;
    await logH(d.membre_id, id ? 'Visite modifiée' : 'Visite enregistrée', `${d.motif || ''} le ${fmtDate(d.date_visite)}`);
    closeModal(); toast('Visite enregistrée.'); await load(); draw(); });
}
async function del(id) { if (!confirm('Supprimer cette visite ?')) return;
  await run(async () => { const { error } = await sb.from('visites').delete().eq('id', id); if (error) throw error; await load(); draw(); toast('Visite supprimée.'); }); }

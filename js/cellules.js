let CELS = [], MEM = [];
boot('cellules', 'Cellules', async () => { $('#add').onclick = () => edit(); await load(); });
async function load() {
  [CELS, MEM] = await Promise.all([fetchAll(() => sb.from('cellules').select('*').order('nom')), fetchAll(() => sb.from('membres').select('id,cellule_id').eq('archive', false).order('id'))]);
  $('#list').innerHTML = table(['Cellule', 'Responsable', 'Lieu', 'Jour et heure', 'Membres', 'Actions'], CELS.map(c => [`<b>${esc(c.nom)}</b>`, esc(c.responsable || '—'), esc(c.lieu || '—'), esc([c.jour, c.heure].filter(Boolean).join(' à ') || '—'), MEM.filter(m => m.cellule_id === c.id).length,
    `<button class="btn sm ghost" onclick="edit('${c.id}')">Modifier</button>` + (isResp() ? `<button class="btn sm red" onclick="del('${c.id}')">Supprimer</button>` : '')]), 'Aucune cellule. Créez la première.');
}
function edit(id) {
  const c = id ? CELS.find(x => x.id === id) : {};
  const b = openModal(id ? 'Modifier la cellule' : 'Nouvelle cellule', `<label class="f"><span>Nom de la cellule *</span><input name="nom"></label><label class="f"><span>Responsable</span><input name="responsable"></label>
    <label class="f"><span>Lieu de réunion</span><input name="lieu"></label><div class="fg"><label class="f"><span>Jour</span><input name="jour" placeholder="Mercredi"></label><label class="f"><span>Heure</span><input name="heure" placeholder="18h00"></label></div>
    <div class="foot"><span></span><button class="btn" id="ok">Enregistrer</button></div>`);
  fillForm(b, c);
  $('#ok', b).onclick = () => run(async () => { const d = formData(b); if (!d.nom) return toast('Le nom est obligatoire.', 'bad');
    const { error } = id ? await sb.from('cellules').update(d).eq('id', id) : await sb.from('cellules').insert(d); if (error) throw error;
    closeModal(); toast('Cellule enregistrée.'); await load(); });
}
async function del(id) { if (!confirm('Supprimer cette cellule ? Ses réunions seront aussi supprimées.')) return;
  await run(async () => { const { error } = await sb.from('cellules').delete().eq('id', id); if (error) throw error; toast('Cellule supprimée.'); await load(); }); }

let EVT = [];
const TYPES = ['Culte spécial', 'Conférence', 'Évangélisation', 'Baptême', 'Réunion', 'Autre'];
boot('evenements', 'Événements et programmes', async () => { $('#add').onclick = () => edit(); await load(); if (new URLSearchParams(location.search).get('nouveau')) edit(); });
async function load() {
  EVT = await fetchAll(() => sb.from('evenements').select('*').order('date', { ascending: false }).order('id'));
  $('#list').innerHTML = table(['Date', 'Événement', 'Type', 'Lieu', 'Participants', 'Compte rendu', ''], EVT.map(e => [fmtDate(e.date) + (e.date >= today() ? ' ' + badge('À venir', 'g') : ''), `<b>${esc(e.titre)}</b><br><small>${esc(e.description || '')}</small>`, esc(e.type || ''), esc(e.lieu || ''), e.participants ?? '—', esc(e.compte_rendu || ''),
    `<button class="btn sm ghost" onclick="edit('${e.id}')">Modifier</button>` + (isResp() ? `<button class="btn sm red" onclick="del('${e.id}')">✕</button>` : '')]), 'Aucun événement enregistré.');
}
function edit(id) {
  const e = id ? EVT.find(x => x.id === id) : { date: today() };
  const b = openModal(id ? "Modifier l'événement" : 'Nouvel événement', `<div class="fg"><label class="f full"><span>Titre *</span><input name="titre"></label>
    <label class="f"><span>Date *</span><input type="date" name="date"></label><label class="f"><span>Type</span><select name="type">${TYPES.map(t => `<option>${t}</option>`).join('')}</select></label>
    <label class="f"><span>Lieu</span><input name="lieu"></label><label class="f"><span>Nombre de participants</span><input type="number" min="0" name="participants"></label>
    <label class="f full"><span>Description du programme</span><textarea name="description"></textarea></label><label class="f full"><span>Compte rendu</span><textarea name="compte_rendu"></textarea></label></div>
    <div class="foot"><span></span><button class="btn" id="ok">Enregistrer</button></div>`);
  fillForm(b, e);
  $('#ok', b).onclick = () => run(async () => { const d = formData(b); if (!d.titre || !d.date) return toast('Titre et date obligatoires.', 'bad');
    if (d.participants !== null) d.participants = +d.participants;
    const { error } = id ? await sb.from('evenements').update(d).eq('id', id) : await sb.from('evenements').insert(d); if (error) throw error;
    closeModal(); toast('Événement enregistré.'); await load(); });
}
async function del(id) { if (!confirm('Supprimer cet événement ?')) return;
  await run(async () => { const { error } = await sb.from('evenements').delete().eq('id', id); if (error) throw error; toast('Événement supprimé.'); await load(); }); }

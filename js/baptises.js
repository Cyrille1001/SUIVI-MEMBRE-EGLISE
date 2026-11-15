let MEM = [], BAP = [], P;
boot('baptises', 'Personnes baptisées', async () => { P = await getParam(); await load(); draw(); });
async function load() { ({ MEM, BAP } = await loadBapData(P, false)); }
const bapOf = id => BAP.find(b => b.membre_id === id);
const draw = () => drawBpt();
function drawBpt() {
  const rows = MEM.filter(m => m.baptise).sort((a, b) => (b.date_bapteme || '').localeCompare(a.date_bapteme || '')).map(m => { const b = bapOf(m.id) || {};
    return [`<div class="who">${avatar(m)}${lienMembre(m)}</div>`, fmtDate(m.date_bapteme), esc(b.responsable || '—'), esc(b.lieu || '—'), esc(b.observation || ''), isResp() ? `<button class="btn sm ghost" onclick="editBpt('${m.id}')">Modifier</button>` : '']; });
  $('#pane-bpt').innerHTML = `<div class="panel"><p style="margin-top:0"><b>${rows.length}</b> personne(s) baptisée(s)</p>${table(['Nom et prénoms', 'Date du baptême', 'Responsable', 'Lieu', 'Observations', ''], rows, 'Aucune personne baptisée.')}</div>`;
}
function editBpt(mid) {
  const m = MEM.find(x => x.id === mid), b0 = bapOf(mid) || {};
  const b = openModal(`Baptême de ${esc(m.nom_prenoms)}`, `<div class="fg"><label class="f"><span>Date du baptême</span><input type="date" name="date_bapteme"></label><label class="f"><span>Lieu</span><input name="lieu"></label>
    <label class="f full"><span>Responsable du baptême</span><input name="responsable"></label></div><label class="f"><span>Observations</span><textarea name="observation"></textarea></label><div class="foot"><span></span><button class="btn" id="ok">Enregistrer</button></div>`);
  fillForm(b, { date_bapteme: m.date_bapteme, ...b0 });
  $('#ok', b).onclick = () => run(async () => { const d = formData(b); if (!d.date_bapteme) return toast('Indiquez la date.', 'bad');
    let r = await sb.from('baptemes').upsert({ membre_id: mid, statut: 'baptise', ...d }, { onConflict: 'membre_id' }); if (r.error) throw r.error;
    r = await sb.from('membres').update({ baptise: true, date_bapteme: d.date_bapteme }).eq('id', mid); if (r.error) throw r.error;
    closeModal(); await load(); draw(); toast('Baptême mis à jour.'); });
}

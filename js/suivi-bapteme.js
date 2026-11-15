let MEM = [], BAP = [], P;
boot('suivi-bapteme', 'Suivi des baptêmes', async () => { P = await getParam(); await load(); draw(); });
async function load() { ({ MEM, BAP } = await loadBapData(P, false)); }
const draw = () => drawSui();
function drawSui() {
  const rows = BAP.filter(b => b.statut !== 'baptise').map(b => ({ b, m: MEM.find(x => x.id === b.membre_id) })).filter(x => x.m).map(({ b, m }) => [
    `<div class="who">${avatar(m)}${lienMembre(m)}</div>`, badge(...DEC[b.statut]), fmtDate(b.date_decision), fmtDate(b.date_prevue), esc(b.observation || ''),
    isResp() ? `<button class="btn sm ghost" onclick="decision('${b.id}')">Décision</button>` + (b.statut === 'valide' ? `<button class="btn sm" onclick="baptise('${b.id}')">Marquer baptisé</button>` : '') + `<button class="btn sm red" onclick="retirer('${b.id}')">Retirer</button>` : '']);
  $('#pane-sui').innerHTML = `<div class="panel">${table(['Candidat', 'Décision', 'Date décision', 'Date prévue', 'Observation', 'Actions'], rows, 'Aucun candidat sélectionné.')}</div>`;
}
function decision(id) {
  const b0 = BAP.find(x => x.id === id);
  const b = openModal('Décision après validation pastorale', `<label class="f"><span>Décision</span><select name="statut">${Object.entries(DEC).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></label>
    <div class="fg"><label class="f"><span>Date de la décision</span><input type="date" name="date_decision"></label><label class="f"><span>Date prévue du baptême</span><input type="date" name="date_prevue"></label>
    <label class="f"><span>Responsable du baptême</span><input name="responsable"></label><label class="f"><span>Lieu</span><input name="lieu"></label></div>
    <label class="f"><span>Observation</span><textarea name="observation"></textarea></label><div class="foot"><span></span><button class="btn" id="ok">Enregistrer</button></div>`);
  fillForm(b, { date_decision: today(), ...b0 });
  $('#ok', b).onclick = () => run(async () => { const d = formData(b); const { error } = await sb.from('baptemes').update(d).eq('id', id); if (error) throw error;
    await logH(b0.membre_id, 'Décision de baptême', DEC[d.statut][0]); closeModal(); await load(); draw(); toast('Décision enregistrée.'); });
}
function baptise(id) {
  const b0 = BAP.find(x => x.id === id);
  const b = openModal('Enregistrer le baptême', `<div class="fg"><label class="f"><span>Date du baptême *</span><input type="date" name="date_bapteme"></label><label class="f"><span>Lieu</span><input name="lieu"></label>
    <label class="f full"><span>Responsable du baptême</span><input name="responsable"></label></div><label class="f"><span>Observations</span><textarea name="observation"></textarea></label><div class="foot"><span></span><button class="btn" id="ok">Confirmer le baptême</button></div>`);
  fillForm(b, { date_bapteme: b0.date_prevue || today(), ...b0 });
  $('#ok', b).onclick = () => run(async () => { const d = formData(b); if (!d.date_bapteme) return toast('Indiquez la date.', 'bad');
    let r = await sb.from('baptemes').update({ ...d, statut: 'baptise' }).eq('id', id); if (r.error) throw r.error;
    r = await sb.from('membres').update({ baptise: true, date_bapteme: d.date_bapteme }).eq('id', b0.membre_id); if (r.error) throw r.error;
    await logH(b0.membre_id, 'Baptisé', `le ${fmtDate(d.date_bapteme)}`); closeModal(); await load(); draw(); toast('Baptême enregistré.'); });
}
async function retirer(id) { if (!confirm('Retirer ce candidat de la liste de suivi ?')) return;
  await run(async () => { const { error } = await sb.from('baptemes').delete().eq('id', id); if (error) throw error; await load(); draw(); toast('Candidat retiré.'); }); }


let MEM = [], BAP = [], ATT = {}, P;
const DEC = { selectionne: ['Sélectionné, en attente de validation', 'w'], valide: ['Validé par le pastorat', 'ok'], ajourne: ['Ajourné', 'b'] };
boot('baptemes', 'Candidats et baptêmes', async () => {
  P = await getParam(); await load();
  tabsUI($('#tabs'), [['can', 'Candidats (automatique)'], ['sui', 'Suivi et décisions'], ['bpt', 'Personnes baptisées']]);
  draw();
});
async function load() {
  const [m, b, p] = await Promise.all([
    fetchAll(() => sb.from('membres').select('*').eq('archive', false).order('nom_prenoms').order('id')),
    fetchAll(() => sb.from('baptemes').select('*').order('id')),
    fetchAll(() => sb.from('presences').select('membre_id,statut,reunions(date,type)').order('id'))]);
  MEM = m; BAP = b; ATT = computeAttendance(p, P);
}
const A = id => ATT[id] || emptyAtt(), bapOf = id => BAP.find(b => b.membre_id === id);
const draw = () => { drawCan(); drawSui(); drawBpt(); };

function drawCan() {
  $('#pane-can').innerHTML = `<p style="margin-top:0">Règle actuelle : au moins <b>${P.seuil_cultes} cultes</b> et <b>${P.seuil_cellules} cellules</b> avec présence sur les <b>${P.fenetre_jours} derniers jours</b> (modifiable dans Paramètres).</p>
    <div class="bar"><label class="chk"><input type="checkbox" id="callb"> Afficher aussi les non baptisés qui n'atteignent pas ce seuil</label></div><div class="panel" id="cl"></div>`;
  const list = () => { const all = $('#callb').checked;
    const rows = MEM.filter(m => !m.baptise && !bapOf(m.id) && (all || isRegular(A(m.id), P))).map(m => { const a = A(m.id), ok = isRegular(a, P);
      return [`<div class="who">${avatar(m)}${lienMembre(m)}</div>`, `${a.win.culte} / ${P.seuil_cultes}`, `${a.win.cellule} / ${P.seuil_cellules}`, ok ? badge('Règle remplie', 'ok') : badge('Insuffisant', 'w'), m.souhaite_membre ? 'Oui' : '—',
        isResp() ? `<button class="btn sm" onclick="select('${m.id}')">Sélectionner</button>` : '']; });
    $('#cl').innerHTML = table(['Membre', 'Cultes (fenêtre)', 'Cellules (fenêtre)', 'Règle', 'Souhaite être membre', ''], rows, 'Aucun candidat pour le moment.'); };
  $('#callb').onchange = list; list();
}
async function select(id) {
  await run(async () => { const { error } = await sb.from('baptemes').insert({ membre_id: id, statut: 'selectionne' }); if (error) throw error;
    await logH(id, 'Sélectionné pour le baptême'); await load(); draw(); toast('Candidat sélectionné. Enregistrez la décision dans « Suivi et décisions ».'); });
}

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

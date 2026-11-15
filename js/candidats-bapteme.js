let MEM = [], BAP = [], ATT = {}, P;
boot('candidats-bapteme', 'Candidats au baptême', async () => { P = await getParam(); await load(); draw(); });
async function load() { ({ MEM, BAP, ATT } = await loadBapData(P)); }
const A = id => ATT[id] || emptyAtt(), bapOf = id => BAP.find(b => b.membre_id === id);
const draw = () => drawCan();
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


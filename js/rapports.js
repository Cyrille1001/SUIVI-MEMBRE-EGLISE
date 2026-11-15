boot('rapports', 'Rapports et statistiques', async () => {
  const n = new Date();
  $('#pm').value = `${n.getFullYear()}-${pad(n.getMonth() + 1)}`; $('#py').value = n.getFullYear();
  const sync = () => { const m = $('#mode').value === 'mois'; $('#pm').style.display = m ? '' : 'none'; $('#py').style.display = m ? 'none' : ''; build(); };
  $('#mode').onchange = sync; $('#pm').onchange = $('#py').onchange = () => run(build); sync();
});

async function build() {
  await run(async () => {
    const mois = $('#mode').value === 'mois'; let d1, d2, titre;
    if (mois) { const [y, m] = $('#pm').value.split('-').map(Number); d1 = `${y}-${pad(m)}-01`; d2 = iso(new Date(y, m, 0)); titre = `Rapport de ${MOIS[m - 1]} ${y}`; }
    else { const y = $('#py').value; d1 = `${y}-01-01`; d2 = `${y}-12-31`; titre = `Rapport annuel ${y}`; }
    const inR = d => d && d >= d1 && d <= d2;
    const [mem, reu, pres, vis, bap, evt, cel] = await Promise.all([
      fetchAll(() => sb.from('membres').select('*').order('id')), fetchAll(() => sb.from('reunions').select('*').gte('date', d1).lte('date', d2).order('date').order('id')),
      fetchAll(() => sb.from('presences').select('reunion_id,statut').order('id')), fetchAll(() => sb.from('visites').select('*').gte('date_visite', d1).lte('date_visite', d2).order('id')),
      fetchAll(() => sb.from('baptemes').select('*').order('id')), fetchAll(() => sb.from('evenements').select('*').gte('date', d1).lte('date', d2).order('date').order('id')),
      fetchAll(() => sb.from('cellules').select('*').order('nom'))]);
    const actifs = mem.filter(m => !m.archive), cnt = {};
    const rid = new Set(reu.map(r => r.id)); pres.filter(p => rid.has(p.reunion_id)).forEach(p => { (cnt[p.reunion_id] ||= { present: 0, absent: 0, excuse: 0 })[p.statut]++; });
    const g = id => cnt[id] || { present: 0, absent: 0, excuse: 0 };
    const nomDe = id => mem.find(m => m.id === id)?.nom_prenoms || '—';
    const sec = (t, html) => `<div class="panel sect"><h3>${t}</h3>${html}</div>`;
    const stat = (l, v, c = '') => `<div class="stat ${c}"><b>${v}</b><span>${l}</span></div>`;
    const cultes = reu.filter(r => r.type === 'culte'), cellR = reu.filter(r => r.type === 'cellule');
    const totP = cultes.reduce((s, r) => s + g(r.id).present, 0);
    const nouveaux = actifs.filter(m => inR(m.date_integration)), convertis = nouveaux.filter(m => m.nouveau_converti), baptises = mem.filter(m => m.baptise && inR(m.date_bapteme));
    const bapP = bap.filter(b => inR(b.created_at.slice(0, 10)));
    const motifs = {}; vis.forEach(v => motifs[v.motif || 'Non précisé'] = (motifs[v.motif || 'Non précisé'] || 0) + 1);

    $('#rep').innerHTML = `<h2 style="margin-bottom:12px">${titre}</h2><div class="grid">${stat('Membres (fin de période)', actifs.length)}${stat('Nouveaux membres', nouveaux.length, 'g')}${stat('Nouveaux convertis', convertis.length, 'g')}${stat('Baptisés sur la période', baptises.length, 'ok')}${stat('Visites effectuées', vis.length)}${stat('Événements', evt.length, 'w')}</div>`
      + sec('Présences aux cultes', `<p>${cultes.length} culte(s) · effectif moyen <b>${cultes.length ? Math.round(totP / cultes.length) : 0}</b></p>` + table(['Date', 'Culte', 'Présents', 'Absents', 'Excusés'], cultes.map(r => [fmtDate(r.date), esc(r.titre || 'Culte'), g(r.id).present, g(r.id).absent, g(r.id).excuse]), 'Aucun culte sur la période.'))
      + sec('Gestion des cellules', table(['Cellule', 'Réunions', 'Total présences', 'Effectif moyen'], cel.map(c => { const rs = cellR.filter(r => r.cellule_id === c.id), t = rs.reduce((s, r) => s + g(r.id).present, 0); return [esc(c.nom), rs.length, t, rs.length ? (t / rs.length).toFixed(1) : '—']; }), 'Aucune cellule.'))
      + sec('Visites et suivi', `<p>${vis.length} visite(s) · ${new Set(vis.map(v => v.membre_id)).size} membre(s) visité(s)</p>` + table(['Motif', 'Nombre'], Object.entries(motifs).map(([k, v]) => [esc(k), v]), 'Aucune visite sur la période.'))
      + sec('Candidats au baptême', `<p>Sélectionnés : ${bapP.length} · validés : ${bapP.filter(b => b.statut === 'valide').length} · ajournés : ${bapP.filter(b => b.statut === 'ajourne').length} · baptisés : ${bapP.filter(b => b.statut === 'baptise').length}</p>` + table(['Candidat', 'Statut', 'Date prévue'], bapP.map(b => [esc(nomDe(b.membre_id)), b.statut, fmtDate(b.date_prevue)]), 'Aucun candidat sur la période.'))
      + sec('Membres baptisés', table(['Nom et prénoms', 'Date', 'Responsable', 'Lieu'], baptises.map(m => { const b = bap.find(x => x.membre_id === m.id) || {}; return [esc(m.nom_prenoms), fmtDate(m.date_bapteme), esc(b.responsable || '—'), esc(b.lieu || '—')]; }), 'Aucun baptême sur la période.'))
      + sec('Nouveaux convertis', table(['Nom et prénoms', 'Intégré le', 'Téléphone'], convertis.map(m => [esc(m.nom_prenoms), fmtDate(m.date_integration), esc(m.telephone || '—')]), 'Aucun nouveau converti sur la période.'))
      + sec('Événements et programmes', table(['Date', 'Événement', 'Type', 'Lieu', 'Participants'], evt.map(e => [fmtDate(e.date), esc(e.titre), esc(e.type || ''), esc(e.lieu || ''), e.participants ?? '—']), 'Aucun événement sur la période.'));
  });
}

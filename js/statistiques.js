let MEM = [], CEL = [], REU = [], PRES = [], P;
boot('statistiques', 'Statistiques de participation', async () => { P = await getParam(); ({ MEM, CEL, REU, PRES } = await loadPresenceData(P)); drawSta(); });

function drawSta() {
  const c = countsByReunion(PRES);
  const sect = (t, type) => {
    const rs = REU.filter(r => r.type === type), tot = rs.reduce((s, r) => s + (c[r.id]?.present || 0), 0);
    const all = rs.reduce((s, r) => s + Object.values(c[r.id] || {}).reduce((x, y) => x + y, 0), 0);
    const last = [...rs].reverse().slice(-12);
    return `<div class="panel"><h3>${t}</h3><div class="grid"><div class="stat"><b>${rs.length}</b><span>Réunions</span></div><div class="stat ok"><b>${rs.length ? Math.round(tot / rs.length) : 0}</b><span>Effectif moyen</span></div><div class="stat g"><b>${all ? Math.round(tot / all * 100) : 0}%</b><span>Taux de présence</span></div></div>
      ${last.length ? bars(last.map(r => ({ label: fmtDate(r.date).slice(0, 5), value: c[r.id]?.present || 0 }))) : '<p class="empty">Aucune donnée.</p>'}</div>`;
  };
  const parCel = CEL.map(cl => { const rs = REU.filter(r => r.cellule_id === cl.id); const t = rs.reduce((s, r) => s + (c[r.id]?.present || 0), 0);
    return [esc(cl.nom), MEM.filter(m => m.cellule_id === cl.id).length, rs.length, rs.length ? (t / rs.length).toFixed(1) : '—']; });
  $('#pane-sta').innerHTML = sect('Cultes', 'culte') + sect('Cellules (ensemble)', 'cellule') + `<div class="panel"><h3>Par cellule</h3>${table(['Cellule', 'Membres', 'Réunions', 'Effectif moyen'], parCel, 'Aucune cellule.')}</div>`;
}

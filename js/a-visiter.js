let MEM = [], VIS = [], ABS = [], P;
boot('a-visiter', 'Membres à visiter', async () => { P = await getParam(); await load(); draw(); });
async function load() {
  [MEM, VIS, ABS] = await Promise.all([
    fetchAll(() => sb.from('membres').select('id,matricule,nom_prenoms,telephone,photo_url').eq('archive', false).order('nom_prenoms').order('id')),
    fetchAll(() => sb.from('visites').select('*').order('date_visite', { ascending: false }).order('id')),
    fetchAll(() => sb.from('presences').select('membre_id,reunions(date,type,titre,cellules(nom))').eq('statut', 'absent').order('id'))]);
}
const nm = id => MEM.find(m => m.id === id);

/* Membres absents à un culte ou une cellule dans la période, sans visite depuis leur dernière absence */
function absentsAVisiter(abs, membres, derniereVisite, limite) {
  const mem = Object.fromEntries(membres.map(m => [m.id, m])), parM = {};
  abs.forEach(a => { if (a.reunions && a.reunions.date >= limite && mem[a.membre_id]) (parM[a.membre_id] ||= []).push(a.reunions); });
  const tous = Object.entries(parM).map(([id, L]) => { L.sort((x, y) => y.date.localeCompare(x.date)); return { m: mem[id], L, der: L[0], lastV: derniereVisite[id]?.date_visite || null }; });
  const aVisiter = tous.filter(x => !x.lastV || x.lastV < x.der.date)
    .sort((x, y) => y.L.length - x.L.length || y.der.date.localeCompare(x.der.date));
  return { aVisiter, dejaVisites: tous.length - aVisiter.length };
}

function draw() {
  const last = {}; VIS.forEach(v => { if (!last[v.membre_id]) last[v.membre_id] = v; });
  const dues = Object.values(last).filter(v => v.prochaine_visite && nm(v.membre_id)).sort((a, b) => a.prochaine_visite.localeCompare(b.prochaine_visite));
  const { aVisiter, dejaVisites } = absentsAVisiter(ABS, MEM, last, daysAgo(P.jours_actif));
  const lieu = r => r.type === 'culte' ? 'Culte' : 'Cellule ' + esc(r.cellules?.nom || '');

  $('#pane-avi').innerHTML = `<div class="panel"><h3>Prochaines visites planifiées</h3>${table(['Prévue le', 'Membre', 'Dernier motif', ''], dues.map(v => [fmtDate(v.prochaine_visite) + (v.prochaine_visite < today() ? ' ' + badge('En retard', 'b') : ''), lienMembre(nm(v.membre_id)), esc(v.motif || ''), `<a class="btn sm" href="visites.html?membre=${v.membre_id}">Enregistrer la visite</a>`]), 'Aucune visite planifiée.')}</div>
    <div class="panel"><h3>Membres absents à visiter (${aVisiter.length})</h3>
    <p style="color:var(--mut);margin-top:0">Membres absents à au moins un culte ou une cellule ces ${P.jours_actif} derniers jours et pas encore visités depuis leur dernière absence.${dejaVisites ? ` ${dejaVisites} membre(s) déjà visité(s) depuis leur absence ne sont pas affichés.` : ''}</p>
    ${table(['Membre', 'Téléphone', 'Dernière absence', `Absences (${P.jours_actif} j)`, 'Dernière visite', ''], aVisiter.map(({ m, L, der, lastV }) => [
      `<div class="who">${avatar(m)}${lienMembre(m)}</div>`,
      m.telephone ? `${esc(m.telephone)} ${waLink(m.telephone) ? `<a href="${waLink(m.telephone)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}` : '—',
      `${fmtDate(der.date)} · ${lieu(der)}`, badge(L.length, L.length >= 2 ? 'b' : 'w'), fmtDate(lastV),
      `<a class="btn sm" href="visites.html?membre=${m.id}">Visiter</a>`]),
      ABS.some(a => a.reunions && a.reunions.date >= daysAgo(P.jours_actif)) ? 'Aucun membre absent à visiter : tous ont été visités depuis leur dernière absence.' : `Aucune absence enregistrée sur les ${P.jours_actif} derniers jours.`)}</div>`;
}

boot('dashboard', 'Tableau de bord', async () => {
  const P = await getParam();
  const [membres, pres, vis, cel, reu, bap] = await Promise.all([
    fetchAll(() => sb.from('membres').select('*').eq('archive', false).order('id')),
    fetchAll(() => sb.from('presences').select('membre_id,statut,reunion_id,reunions(date,type)').order('id')),
    fetchAll(() => sb.from('visites').select('membre_id,date_visite,prochaine_visite').order('id')),
    fetchAll(() => sb.from('cellules').select('id,nom').order('id')),
    fetchAll(() => sb.from('reunions').select('id,date,type,cellule_id,titre').order('date').order('id')),
    fetchAll(() => sb.from('baptemes').select('*').order('id'))]);
  const att = computeAttendance(pres, P), A = id => att[id] || emptyAtt();
  const ids = new Set(membres.map(m => m.id));
  const nouveaux = membres.filter(m => m.date_integration >= daysAgo(30)).length;
  const actifs = membres.filter(m => A(m.id).activeRecent).length;
  const baptises = membres.filter(m => m.baptise).length;
  const selection = new Set(bap.filter(b => ['selectionne', 'valide'].includes(b.statut)).map(b => b.membre_id));
  const attente = membres.filter(m => !m.baptise && (selection.has(m.id) || (isRegular(A(m.id), P) && !bap.some(b => b.membre_id === m.id)))).length;
  const visites = new Set(vis.filter(v => ids.has(v.membre_id)).map(v => v.membre_id));
  const cultes = reu.filter(r => r.type === 'culte'), dernier = cultes.at(-1);
  const absents = dernier ? pres.filter(p => p.reunion_id === dernier.id && p.statut === 'absent' && ids.has(p.membre_id)).length : 0;
  const mois = new Date().getMonth() + 1;
  const anniv = membres.filter(m => m.date_naissance && +m.date_naissance.slice(5, 7) === mois).sort((a, b) => a.date_naissance.slice(8) - b.date_naissance.slice(8));

  const prenom = (ME.nom || ME.username).split(/\s+/)[0], h = new Date().getHours();
  const dernierPresents = dernier ? pres.filter(p => p.reunion_id === dernier.id && p.statut === 'present').length : 0;
  $('#hero').innerHTML = `<div class="hero"><h2>${h < 18 ? 'Bonjour' : 'Bonsoir'}, ${esc(prenom)}</h2>
    <p>${membres.length} membre(s) suivi(s), dont ${actifs} actif(s) ces ${P.jours_actif} derniers jours.${dernier ? ` Le dernier culte (${fmtDate(dernier.date)}) a réuni ${dernierPresents} présent(s).` : ' Aucun culte enregistré pour le moment.'}</p>
    <div class="acts"><a class="btn" href="membres.html?edit=new" data-ico="userplus">Nouveau membre</a><a class="btn gl" href="presences.html" data-ico="check">Pointer un culte ou cellule</a><a class="btn gl" href="evenements.html?nouveau=1" data-ico="calendar">Nouvel événement</a></div></div>`;

  const card = (l, v, icon, c) => `<div class="stat ic c-${c}"><span class="si">${ico(icon)}</span><div><b data-n="${v}">0</b><span>${l}</span></div></div>`;
  $('#cards').innerHTML = card('Membres enregistrés', membres.length, 'users', 'pri') + card('Nouveaux membres (30 jours)', nouveaux, 'userplus', 'gold') + card(`Membres actifs (${P.jours_actif} jours)`, actifs, 'pulse', 'ok')
    + card('Membres baptisés', baptises, 'drop', 'sky') + card('En attente de baptême', attente, 'clock', 'warn') + card('Personnes visitées', visites.size, 'pin', 'pri')
    + card('Cellules', cel.length, 'grid', 'gold') + card(dernier ? `Absents au dernier culte (${fmtDate(dernier.date)})` : 'Absents au dernier culte', absents, 'userx', 'bad') + card('Anniversaires du mois', anniv.length, 'gift', 'ok');

  const cnt = {}; pres.forEach(p => { if (p.statut === 'present') cnt[p.reunion_id] = (cnt[p.reunion_id] || 0) + 1; });
  $('#chart').innerHTML = cultes.length ? bars(cultes.slice(-8).map(c => ({ label: fmtDate(c.date).slice(0, 5), value: cnt[c.id] || 0 }))) : '<p class="empty">Aucun culte enregistré pour le moment.</p>';
  $('#bday').innerHTML = anniv.length ? `<ul class="list">${anniv.map(m => `<li><span>${lienMembre(m)}</span><span>${+m.date_naissance.slice(8)} ${MOIS[mois - 1]} · ${new Date().getFullYear() - +m.date_naissance.slice(0, 4)} ans</span></li>`).join('')}</ul>` : '<p class="empty">Aucun anniversaire ce mois-ci.</p>';

  /* Points d'attention : membres absents au dernier culte et à la dernière réunion de chaque cellule (les visites partent de là) */
  const mem = Object.fromEntries(membres.map(m => [m.id, m]));
  const st = {}; pres.forEach(p => (st[p.membre_id] ||= {})[p.reunion_id] = p.statut);
  const bloc = (titre, liste) => {
    const last = liste.at(-1); if (!last) return '';
    const ab = pres.filter(p => p.reunion_id === last.id && p.statut === 'absent' && mem[p.membre_id]).map(p => mem[p.membre_id]).sort((a, b) => a.nom_prenoms.localeCompare(b.nom_prenoms));
    return `<div class="sect"><h3>${titre} · ${fmtDate(last.date)} ${badge(ab.length + ' absent(s)', ab.length ? 'b' : 'ok')}</h3>` + table(['Membre', 'Téléphone', 'Absences de suite', ''], ab.map(m => { const n = serieAbsences(st[m.id], liste);
      return [`<div class="who">${avatar(m)}${lienMembre(m)}</div>`, m.telephone ? `${esc(m.telephone)} ${waLink(m.telephone) ? `<a href="${waLink(m.telephone)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}` : '—', n >= 2 ? badge(n + ' de suite', 'b') : '1', `<a class="btn sm ghost" href="visites.html?membre=${m.id}">Visiter</a>`]; }), 'Aucun absent à cette réunion.') + '</div>';
  };
  const blocs = [bloc('Dernier culte', cultes), ...cel.map(c => bloc(`Cellule ${esc(c.nom)}`, reu.filter(r => r.cellule_id === c.id)))].filter(Boolean);
  $('#alerts').innerHTML = blocs.join('') || '<p class="empty">Aucun culte ni cellule enregistré pour le moment.</p>';
});

/* Nombre d'absences consécutives (de la réunion la plus récente en remontant) */
function serieAbsences(statuts, liste) {
  let n = 0;
  for (let i = liste.length - 1; i >= 0; i--) { if (statuts?.[liste[i].id] === 'absent') n++; else break; }
  return n;
}

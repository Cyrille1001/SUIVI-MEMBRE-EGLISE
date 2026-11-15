boot('membres', 'Fiche membre', async () => {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return location.href = 'membres.html';
  const P = await getParam();
  const [m, pres, vis, bap, his, cel] = await Promise.all([
    sb.from('membres').select('*').eq('id', id).single(),
    fetchAll(() => sb.from('presences').select('statut,observation,reunions(date,type,titre,cellules(nom))').eq('membre_id', id).order('id')),
    sb.from('visites').select('*').eq('membre_id', id).order('date_visite', { ascending: false }),
    sb.from('baptemes').select('*').eq('membre_id', id).maybeSingle(),
    sb.from('historique').select('*').eq('membre_id', id).order('created_at', { ascending: false }),
    sb.from('cellules').select('id,nom')]);
  if (m.error) throw m.error;
  const M = m.data, V = vis.data || [], B = bap.data, H = his.data || [];
  const a = computeAttendance(pres.map(p => ({ ...p, membre_id: id })), P)[id] || emptyAtt();
  const [rl, rc] = regStatus(a, P);
  const cellule = (cel.data || []).find(c => c.id === M.cellule_id);

  $('#fiche').innerHTML = `<div class="panel fiche">${avatar(M)}<div style="flex:1;min-width:220px"><h2>${esc(M.nom_prenoms)}</h2>
    <p style="margin:4px 0">${esc(M.matricule)} · ${badge(rl, rc)} ${M.baptise ? badge('Baptisé', 'ok') : ''} ${M.nouveau_converti ? badge('Nouveau converti', 'g') : ''} ${M.archive ? badge('Archivé', 'b') : ''}</p></div>
    <div><a class="btn ghost" href="membres.html?edit=${M.id}">Modifier la fiche</a> <a class="btn" href="visites.html?membre=${M.id}">＋ Visite</a></div></div><div id="tabs"></div>`;
  $('#tabs').innerHTML = [['inf', 'Informations'], ['pre', 'Présences aux cultes et cellules'], ['vis', `Visites (${V.length})`], ['bap', 'Parcours de baptême'], ['his', 'Historique et observations']].map(([k, l]) => `<section><h3 class="blk-t">${l}</h3><div id="pane-${k}"></div></section>`).join('');
  const kv = (l, v) => `<div><span>${l}</span>${v || '—'}</div>`;
  $('#pane-inf').innerHTML = `<div class="panel"><div class="kv">${kv('Sexe', M.sexe === 'M' ? 'Masculin' : M.sexe === 'F' ? 'Féminin' : '')}${kv('Date de naissance', M.date_naissance ? `${fmtDate(M.date_naissance)} (${age(M.date_naissance)} ans)` : '')}
    ${kv('Téléphone', M.telephone ? `${esc(M.telephone)} ${waLink(M.telephone) ? `<a href="${waLink(M.telephone)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}` : '')}${kv('Lieu d\'habitation', esc(M.lieu_habitation))}${kv('Lieu de travail', esc(M.lieu_travail))}
    ${kv('Cellule', esc(cellule?.nom))}${kv('Date d\'intégration', fmtDate(M.date_integration))}${kv('Souhaite devenir membre', M.souhaite_membre ? 'Oui' : 'Non')}
    ${kv('Consentement données et photo', M.consentement ? `Oui (le ${fmtDate(M.consentement_date)})` : 'Non enregistré')}</div></div>`;

  const sorted = [...pres].filter(p => p.reunions).sort((x, y) => y.reunions.date.localeCompare(x.reunions.date));
  const ST = { present: ['Présent', 'ok'], absent: ['Absent', 'b'], excuse: ['Excusé', 'w'] };
  const bloc = (t, k) => `<div class="stat" style="margin-bottom:12px"><b>${a[k].present} présence(s) · ${a[k].absent} absence(s) · ${a[k].excuse} excusé(s)</b><span>${t}</span></div>`;
  $('#pane-pre').innerHTML = `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${bloc('Cultes', 'culte')}${bloc('Cellules', 'cellule')}</div>
    <p>Dernière présence : <b>${fmtDate(a.last)}</b> · Sur ${P.fenetre_jours} jours : ${a.win.culte} culte(s) (seuil ${P.seuil_cultes}), ${a.win.cellule} cellule(s) (seuil ${P.seuil_cellules})</p>` +
    `<div class="panel">${table(['Date', 'Type', 'Réunion', 'Statut', 'Observation'], sorted.map(p => [fmtDate(p.reunions.date), p.reunions.type === 'culte' ? 'Culte' : 'Cellule', esc(p.reunions.titre || p.reunions.cellules?.nom || ''), badge(...ST[p.statut]), esc(p.observation || '')]), 'Aucune présence enregistrée.')}</div>`;

  $('#pane-vis').innerHTML = `<div class="panel">${table(['Date', 'Motif', 'Lieu', 'Compte rendu', 'Besoins', 'Actions', 'Prochaine'], V.map(v => [fmtDate(v.date_visite), esc(v.motif || ''), esc(v.lieu || ''), esc(v.compte_rendu || ''), esc(v.besoins || ''), esc(v.actions || ''), fmtDate(v.prochaine_visite)]), 'Aucune visite enregistrée pour ce membre.')}</div>`;

  const DEC = { selectionne: 'Sélectionné, en attente de validation', valide: 'Validé par le pastorat', ajourne: 'Ajourné', baptise: 'Baptisé' };
  $('#pane-bap').innerHTML = `<div class="panel"><div class="kv">${kv('Baptisé', M.baptise ? `Oui, le ${fmtDate(M.date_bapteme)}` : 'Non')}${kv('Décision', B ? DEC[B.statut] : (isRegular(a, P) && !M.baptise ? 'Candidat potentiel (règle de présence remplie)' : 'Pas encore candidat'))}
    ${kv('Date prévue', fmtDate(B?.date_prevue))}${kv('Responsable du baptême', esc(B?.responsable))}${kv('Lieu', esc(B?.lieu))}${kv('Observation', esc(B?.observation))}</div></div>`;

  const draw = () => $('#pane-his').innerHTML = `<div class="panel"><label class="f"><span>Ajouter une observation</span><textarea id="obs"></textarea></label><button class="btn" id="addobs">Enregistrer l'observation</button></div>
    <div class="panel">${table(['Date', 'Action', 'Détail', 'Par'], H.map(h => [fmtDate(h.created_at.slice(0, 10)), esc(h.action), esc(h.detail || ''), esc(h.auteur || '')]), 'Aucun historique.')}</div>`;
  draw();
  $('#pane-his').addEventListener('click', e => { if (e.target.id !== 'addobs') return; run(async () => {
    const t = $('#obs').value.trim(); if (!t) return toast('Saisissez une observation.', 'bad');
    await logH(id, 'Observation', t); location.reload(); }); });
});

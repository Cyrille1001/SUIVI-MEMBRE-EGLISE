let MEM = [], CEL = [], REU = [], PRES = [], P, ATT;
const ST = { present: ['Présent', 'ok'], absent: ['Absent', 'b'], excuse: ['Excusé', 'w'] };
boot('presences', 'Cultes et cellules', async () => { P = await getParam(); await load(); draw(); });
async function load() { ({ MEM, CEL, REU, PRES, ATT } = await loadPresenceData(P)); }
const cn = id => CEL.find(c => c.id === id)?.nom || '';
const draw = () => drawReu();

function drawReu() {
  const c = countsByReunion(PRES);
  $('#pane-reu').innerHTML = `<div class="bar"><select id="rt"><option value="">Cultes et cellules</option><option value="culte">Cultes</option><option value="cellule">Cellules</option></select><button class="btn" id="newr">${ico('plus')}Nouveau culte ou cellule</button></div><div class="panel" id="rl"></div>`;
  const list = () => {
    const t = $('#rt').value;
    $('#rl').innerHTML = table(['Date', 'Type', 'Réunion', 'Présents', 'Absents', 'Excusés', 'Actions'], REU.filter(r => !t || r.type === t).map(r => { const o = c[r.id] || { present: 0, absent: 0, excuse: 0 };
      return [`<button class="linkbtn" onclick="detailReu('${r.id}')" title="Voir les présents et les absents">${fmtDate(r.date)}</button>`, r.type === 'culte' ? badge('Culte') : badge('Cellule', 'g'), esc(r.titre || cn(r.cellule_id) || '—'), `<b>${o.present}</b>`, o.absent, o.excuse,
        `<button class="btn sm" onclick="pointer('${r.id}')">Pointer</button>` + (isResp() ? `<button class="btn sm red" onclick="delReu('${r.id}')">Supprimer</button>` : '')]; }), 'Aucune réunion. Créez votre premier culte ou cellule.');
  };
  $('#rt').onchange = list; list(); $('#newr').onclick = newReu;
}

/* Détail d'un culte ou d'une réunion de cellule : qui était présent, absent, excusé */
function detailReu(rid) {
  const r = REU.find(x => x.id === rid), nm = Object.fromEntries(MEM.map(m => [m.id, m]));
  const lignes = PRES.filter(p => p.reunion_id === rid);
  const par = s => lignes.filter(p => p.statut === s).map(p => ({ p, m: nm[p.membre_id] })).sort((a, b) => (a.m?.nom_prenoms || '~').localeCompare(b.m?.nom_prenoms || '~'));
  const pr = par('present'), ab = par('absent'), ex = par('excuse');
  const pointes = new Set(lignes.map(p => p.membre_id)), nonPointes = MEM.filter(m => (!r.cellule_id || m.cellule_id === r.cellule_id) && !pointes.has(m.id)).length;
  const qui = ({ m }) => m ? `<span class="who">${avatar(m)}${lienMembre(m)}</span>` : '<span style="color:var(--mut)">(fiche archivée)</span>';
  const col = (titre, cls, L, absent) => `<div class="dcol"><h4>${titre} ${badge(L.length, cls)}</h4>${L.length ? `<ul class="list">${L.map(x => `<li><div>${qui(x)}${x.p.observation ? `<br><small style="color:var(--mut)">${esc(x.p.observation)}</small>` : ''}</div>${absent && x.m ? `<span style="text-align:right">${x.m.telephone && waLink(x.m.telephone) ? `<a href="${waLink(x.m.telephone)}" target="_blank" rel="noopener">WhatsApp</a><br>` : ''}<a href="visites.html?membre=${x.m.id}">Visiter</a></span>` : ''}</li>`).join('')}</ul>` : '<p class="empty">Aucun</p>'}</div>`;
  const b = openModal(`${r.type === 'culte' ? 'Culte' : 'Cellule ' + esc(cn(r.cellule_id))} du ${fmtDate(r.date)}`,
    `<p style="margin:0 0 14px;color:var(--mut)">${esc(r.titre || '')}${r.titre ? ' · ' : ''}${pr.length} présent(s), ${ab.length} absent(s), ${ex.length} excusé(s)${nonPointes ? ` · ${nonPointes} membre(s) non pointé(s)` : ''}</p>
     <div class="cols3">${col('Présents', 'ok', pr)}${col('Absents', 'b', ab, true)}${col('Excusés', 'w', ex)}</div>
     <div class="foot"><span></span><button class="btn" id="mod">Modifier le pointage</button></div>`, { wide: true });
  $('#mod', b).onclick = () => { closeModal(); pointer(rid); };
}

function newReu() {
  const b = openModal('Nouveau culte ou cellule', `<label class="f"><span>Type</span><select name="type" id="rtype"><option value="culte">Culte</option><option value="cellule">Cellule</option></select></label>
    <label class="f"><span>Date</span><input type="date" name="date" value="${today()}"></label>
    <label class="f" id="rcel" style="display:none"><span>Cellule</span><select name="cellule_id"><option value="">—</option>${CEL.map(c => `<option value="${c.id}">${esc(c.nom)}</option>`).join('')}</select></label>
    <label class="f"><span>Titre ou thème (facultatif)</span><input name="titre"></label>
    <div class="foot"><span></span><button class="btn" id="ok">Créer et pointer</button></div>`);
  $('#rtype', b).onchange = e => $('#rcel', b).style.display = e.target.value === 'cellule' ? '' : 'none';
  $('#ok', b).onclick = () => run(async () => {
    const d = formData(b); if (!d.date) return toast('Indiquez la date.', 'bad');
    if (d.type === 'cellule' && !d.cellule_id) return toast('Choisissez la cellule.', 'bad');
    if (d.type === 'culte') d.cellule_id = null;
    const r = await sb.from('reunions').insert(d).select().single(); if (r.error) throw r.error;
    await load(); draw(); pointer(r.data.id);
  });
}

async function delReu(id) {
  if (!confirm('Supprimer cette réunion et toutes ses présences ?')) return;
  await run(async () => { const { error } = await sb.from('reunions').delete().eq('id', id); if (error) throw error; await load(); draw(); toast('Réunion supprimée.'); });
}

function pointer(rid) {
  const r = REU.find(x => x.id === rid), S = {};
  PRES.filter(p => p.reunion_id === rid).forEach(p => S[p.membre_id] = { statut: p.statut, obs: p.observation || '' });
  let all = !r.cellule_id, q = '';
  const b = openModal(`${r.type === 'culte' ? 'Culte' : 'Cellule ' + esc(cn(r.cellule_id))} du ${fmtDate(r.date)}`, `
    <div class="bar"><input id="pq" placeholder="Rechercher un membre…">${r.cellule_id ? '<label class="chk"><input type="checkbox" id="pall"> Tous les membres</label>' : ''}
    <button class="btn sm ghost" id="allp">Tous présents</button><button class="btn sm ghost" id="restabs">Non pointés : absents</button></div>
    <div id="plist"></div><div class="foot"><span id="pcount"></span><button class="btn" id="psave">Enregistrer</button></div>`, { wide: true });
  const list = () => MEM.filter(m => (all || m.cellule_id === r.cellule_id) && m.nom_prenoms.toLowerCase().includes(q));
  const count = () => { const v = Object.values(S); $('#pcount', b).textContent = `${v.filter(x => x.statut === 'present').length} présents · ${v.filter(x => x.statut === 'absent').length} absents · ${v.filter(x => x.statut === 'excuse').length} excusés`; };
  const rowsHtml = () => { $('#plist', b).innerHTML = list().map(m => { const s = S[m.id] || {};
    return `<div class="prow"><span class="who">${avatar(m)}${esc(m.nom_prenoms)}</span><span class="pills">${[['present', 'P'], ['absent', 'A'], ['excuse', 'E']].map(([v, l]) =>
      `<label class="pill ${v} ${s.statut === v ? 'on' : ''}" title="${ST[v][0]}"><input type="radio" name="s${m.id}" value="${v}" data-m="${m.id}" ${s.statut === v ? 'checked' : ''}>${l}</label>`).join('')}</span>
      <input data-o="${m.id}" placeholder="Observation" value="${esc(s.obs || '')}"></div>`; }).join('') || '<p class="empty">Aucun membre dans cette liste.</p>'; count(); };
  rowsHtml();
  $('#plist', b).addEventListener('change', e => { const id = e.target.dataset.m; if (!id) return; (S[id] ||= {}).statut = e.target.value;
    $$('.pill', e.target.closest('.prow')).forEach(p => p.classList.toggle('on', p.querySelector('input').checked)); count(); });
  $('#plist', b).addEventListener('input', e => { const id = e.target.dataset.o; if (id) (S[id] ||= {}).obs = e.target.value; });
  $('#pq', b).oninput = e => { q = e.target.value.toLowerCase(); rowsHtml(); };
  $('#pall', b) && ($('#pall', b).onchange = e => { all = e.target.checked; rowsHtml(); });
  $('#allp', b).onclick = () => { list().forEach(m => (S[m.id] ||= {}).statut = 'present'); rowsHtml(); };
  $('#restabs', b).onclick = () => { list().forEach(m => { if (!(S[m.id] || {}).statut) (S[m.id] ||= {}).statut = 'absent'; }); rowsHtml(); };
  $('#psave', b).onclick = () => run(async () => {
    const rows = Object.entries(S).filter(([, s]) => s.statut).map(([membre_id, s]) => ({ reunion_id: rid, membre_id, statut: s.statut, observation: s.obs || null }));
    if (!rows.length) return toast('Aucun membre pointé.', 'bad');
    const { error } = await sb.from('presences').upsert(rows, { onConflict: 'reunion_id,membre_id' }); if (error) throw error;
    closeModal(); await load(); draw(); toast(`${rows.length} pointage(s) enregistré(s).`);
  });
}


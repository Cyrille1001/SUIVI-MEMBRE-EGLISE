/* ===== Caisse : quêtes, offrandes et dépenses =====
   Aucun paiement en ligne : l'argent est encaissé physiquement, l'application enregistre seulement les montants. */
const CAT = {
  entree: ['Quête', 'Offrande spéciale', 'Dîme', 'Don', 'Autre entrée'],
  sortie: ['Fonctionnement', 'Entretien', 'Aide sociale', 'Matériel', 'Autre sortie']
};
const OCCASIONS = ['Culte du dimanche', 'Culte de prière', 'Culte de jeûne', 'Réunion de cellule', 'Événement spécial'];
let MV = [];

boot('caisse', 'Caisse', async () => {
  if (!isResp()) { $('#content').innerHTML = `<p class="empty">La caisse est réservée aux responsables et à l'administrateur.</p>`; return; }
  DEV = (await getParam()).devise || 'FCFA';
  $('#in').onclick = () => edit(null, 'entree'); $('#out').onclick = () => edit(null, 'sortie');
  $('#per').onchange = $('#sens').onchange = render;
  $('#csv').onclick = exporter; $('#prt').onclick = () => window.print();
  await load();
});

async function load() {
  try { MV = await fetchAll(() => sb.from('caisse').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).order('id')); }
  catch (e) {
    if (['PGRST205', '42P01'].includes(e?.code)) throw new Error("La caisse n'est pas encore installée : exécutez sql/03_caisse.sql dans Supabase (SQL Editor).");
    throw e;
  }
  render();
}

/* Période choisie : [début, fin, libellé] */
function periode() {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  switch ($('#per').value) {
    case 'prec': return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0)), `${MOIS[(m + 11) % 12]} ${m ? y : y - 1}`];
    case 'annee': return [`${y}-01-01`, `${y}-12-31`, `année ${y}`];
    case 'tout': return ['0000-01-01', '9999-12-31', 'depuis le début'];
    default: return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0)), `${MOIS[m]} ${y}`];
  }
}
const filtrer = () => { const [d1, d2, label] = periode(), sens = $('#sens').value;
  const periodeRows = MV.filter(x => x.date >= d1 && x.date <= d2);
  return { label, periodeRows, rows: sens ? periodeRows.filter(x => x.sens === sens) : periodeRows }; };

function render() {
  const { label, periodeRows, rows } = filtrer();
  const ent = caisseTotal(periodeRows, 'entree'), sor = caisseTotal(periodeRows, 'sortie'), soldeP = r2(ent - sor), soldeG = r2(caisseTotal(MV, 'entree') - caisseTotal(MV, 'sortie'));
  const stat = (l, v, c = '') => `<div class="stat ${c}"><b>${moneyHtml(v)}</b><span>${l}</span></div>`;
  $('#stats').innerHTML = `<h2 class="po">Caisse – ${esc(label)}</h2><div class="grid">${stat('Entrées de la période', ent, 'ok')}${stat('Sorties de la période', sor, 'b')}${stat('Solde de la période', soldeP, soldeP < 0 ? 'b' : 'g')}${stat('Solde général en caisse', soldeG, soldeG < 0 ? 'b' : '')}</div>`;

  const g = {};
  rows.forEach(x => { const o = g[x.sens + '|' + x.categorie] ||= { sens: x.sens, cat: x.categorie, n: 0, t: 0 }; o.n++; o.t += Number(x.montant); });
  const lignes = Object.values(g).sort((a, b) => a.sens.localeCompare(b.sens) || b.t - a.t);
  $('#cats').innerHTML = `<h3>Répartition par catégorie</h3>` + table(['Type', 'Catégorie', 'Nombre', 'Total'],
    lignes.map(o => [sensBadge(o.sens), esc(o.cat), o.n, `<b>${money(r2(o.t))}</b>`]), 'Aucun mouvement sur cette période.');

  $('#list').innerHTML = `<h3>Mouvements – ${esc(label)} (${rows.length})</h3>` + table(['Date', 'Type', 'Catégorie', 'Occasion et détail', 'Montant', 'Saisi par', ''],
    rows.map(x => [fmtDate(x.date), sensBadge(x.sens), esc(x.categorie),
      [x.occasion && `<b>${esc(x.occasion)}</b>`, x.libelle && `<small>${esc(x.libelle)}</small>`].filter(Boolean).join('<br>'),
      `<b style="color:var(--${x.sens === 'entree' ? 'ok' : 'bad'})">${x.sens === 'entree' ? '+' : '−'}&nbsp;${money(Number(x.montant))}</b>`,
      esc(x.saisi_par || '') + (x.modifie_par ? `<br><small>modifié par ${esc(x.modifie_par)}</small>` : ''),
      `<button class="btn sm ghost" onclick="edit('${x.id}')">Modifier</button>` + (isAdmin() ? `<button class="btn sm red" onclick="del('${x.id}')">✕</button>` : '')]),
    'Aucun mouvement sur cette période.');
}

function edit(id, sens0) {
  const m = id ? MV.find(x => x.id === id) : { date: today(), sens: sens0 || 'entree', categorie: CAT[sens0 || 'entree'][0] };
  if (!m) return;
  const entree = m.sens === 'entree';       // le type vient du bouton cliqué (ou de la ligne modifiée) : pas de champ à remplir
  const b = openModal(id ? (entree ? 'Modifier un encaissement' : 'Modifier une dépense') : (entree ? 'Nouvel encaissement' : 'Nouvelle dépense'), `<div class="fg">
    <label class="f"><span>Date *</span><input type="date" name="date"></label>
    <label class="f"><span>Montant (${esc(DEV)}) *</span><input type="number" name="montant" min="0" step="any" inputmode="decimal"></label>
    <label class="f"><span>Catégorie *</span><select name="categorie"></select></label>
    <label class="f"><span>Occasion</span><input name="occasion" list="occ" placeholder="Ex. : Culte du dimanche"><datalist id="occ">${OCCASIONS.map(o => `<option value="${esc(o)}">`).join('')}</datalist></label>
    <label class="f full"><span>Détail ou note</span><textarea name="libelle"></textarea></label></div>
    <div class="foot"><span></span><button class="btn" id="ok">Enregistrer</button></div>`);
  const l = [...CAT[m.sens]]; if (m.categorie && !l.includes(m.categorie)) l.push(m.categorie);
  $('[name=categorie]', b).innerHTML = l.map(c => `<option>${esc(c)}</option>`).join('');
  fillForm(b, m);
  $('#ok', b).onclick = async e => {
    const btn = e.currentTarget; if (btn.disabled) return; btn.disabled = true;       // évite un double enregistrement
    await run(async () => {
      const d = formData(b); d.montant = Number(d.montant); d.sens = m.sens;
      if (!d.date || !d.categorie || !(d.montant > 0)) return toast('Date, catégorie et montant (supérieur à 0) sont obligatoires.', 'bad');
      const auteur = ME.nom || ME.username;
      const { error } = id ? await sb.from('caisse').update({ ...d, modifie_par: auteur }).eq('id', id) : await sb.from('caisse').insert({ ...d, saisi_par: auteur });
      if (error) throw error;
      closeModal(); toast('Enregistré dans la caisse.'); await load();
    });
    btn.disabled = false;
  };
}

async function del(id) {
  const m = MV.find(x => x.id === id);
  if (!m || !confirm(`Supprimer ce mouvement de ${money(Number(m.montant))} (${fmtDate(m.date)}) ? Cette action est définitive.`)) return;
  await run(async () => { const { error } = await sb.from('caisse').delete().eq('id', id); if (error) throw error; toast('Mouvement supprimé.'); await load(); });
}

function exporter() {
  const { label, rows } = filtrer();
  if (!rows.length) return toast('Rien à exporter sur cette période.', 'bad');
  downloadCSV(`caisse-${norm(label)}.csv`, ['Date', 'Type', 'Catégorie', 'Occasion', 'Détail', `Montant (${DEV})`, 'Saisi par'],
    [...rows].sort((a, b) => a.date.localeCompare(b.date)).map(x => [fmtDate(x.date), x.sens === 'entree' ? 'Entrée' : 'Sortie', x.categorie, x.occasion || '', x.libelle || '', String(Number(x.montant)).replace('.', ','), x.saisi_par || '']));
}

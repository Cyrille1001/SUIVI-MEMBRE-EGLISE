/* ===== Import de membres depuis un fichier CSV (Excel : Enregistrer sous > CSV) ===== */
const CHAMPS = {
  nom_prenoms: ['nom', 'nomprenoms', 'nometprenoms', 'nomcomplet', 'membre'],
  sexe: ['sexe', 'genre'],
  date_naissance: ['datenaissance', 'datedenaissance', 'naissance'],
  telephone: ['telephone', 'tel', 'contact', 'numero', 'phone'],
  lieu_habitation: ['lieuhabitation', 'lieudhabitation', 'habitation', 'residence', 'quartier', 'adresse'],
  lieu_travail: ['lieutravail', 'lieudetravail', 'travail', 'profession'],
  date_integration: ['dateintegration', 'datedintegration', 'integration'],
  nouveau_converti: ['nouveauconverti', 'converti'],
  baptise: ['baptise', 'bapteme', 'estbaptise'],
  date_bapteme: ['datebapteme', 'datedubapteme']
};
const LIBELLES = { nom_prenoms: 'Nom et prénoms', sexe: 'Sexe', date_naissance: 'Date de naissance', telephone: 'Téléphone', lieu_habitation: "Lieu d'habitation", lieu_travail: 'Lieu de travail', date_integration: "Date d'intégration", nouveau_converti: 'Nouveau converti', baptise: 'Baptisé', date_bapteme: 'Date du baptême' };

function parseCSV(txt) {
  txt = txt.replace(/^\ufeff/, '');
  const first = txt.split(/\r?\n/)[0];
  const sep = [';', '\t', ','].map(s => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
function detectCols(header) {
  const cols = {}, inconnues = [];
  header.forEach((h, i) => {
    const n = norm(h), c = Object.keys(CHAMPS).find(k => CHAMPS[k].includes(n));
    if (c && cols[c] === undefined) cols[c] = i; else if (String(h).trim()) inconnues.push(String(h).trim());
  });
  return { cols, inconnues };
}
/* null = vide, undefined = invalide */
function parseDate(v) {
  v = String(v || '').trim(); if (!v) return null;
  let m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/), y, mo, d;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += y > 30 ? 1900 : 2000; }
  else if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else return undefined;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return undefined;
  return `${y}-${pad(mo)}-${pad(d)}`;
}
const parseBool = v => /^(oui|o|yes|y|1|vrai|true|x)$/.test(norm(v));
function parseSexe(v) {
  const n = norm(v); if (!n) return null;
  if (['m', 'masculin', 'homme', 'h'].includes(n)) return 'M';
  if (['f', 'feminin', 'femme'].includes(n)) return 'F';
  return undefined;
}
const cle = (nom, tel) => norm(nom) + '|' + String(tel || '').replace(/\D/g, '');

function buildRows(rows, cols, existing) {
  const seen = new Set(existing), ok = [], dup = [], err = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2, g = c => cols[c] === undefined ? '' : String(r[cols[c]] ?? '').trim(), e = [];
    const o = { nom_prenoms: g('nom_prenoms') };
    if (!o.nom_prenoms) e.push('nom manquant');
    const sx = parseSexe(g('sexe')); if (sx === undefined) e.push('sexe non reconnu'); else o.sexe = sx;
    for (const [c, lib] of [['date_naissance', 'date de naissance'], ['date_integration', "date d'intégration"], ['date_bapteme', 'date de baptême']]) {
      const d = parseDate(g(c)); if (d === undefined) e.push(lib + ' invalide'); else o[c] = d;
    }
    if (o.date_naissance && o.date_naissance > today()) e.push('date de naissance dans le futur');
    o.telephone = g('telephone') || null; o.lieu_habitation = g('lieu_habitation') || null; o.lieu_travail = g('lieu_travail') || null;
    o.nouveau_converti = parseBool(g('nouveau_converti')); o.baptise = parseBool(g('baptise')) || !!o.date_bapteme;
    if (!o.baptise) o.date_bapteme = null;
    o.date_integration = o.date_integration || today();
    if (e.length) { err.push({ line, nom: o.nom_prenoms, msg: e.join(', ') }); return; }
    const k = cle(o.nom_prenoms, o.telephone);
    if (seen.has(k)) { dup.push({ line, nom: o.nom_prenoms }); return; }
    seen.add(k); ok.push(o);
  });
  return { ok, dup, err };
}

boot('import', 'Importer des membres', async () => {
  if (!isResp()) { location.href = 'dashboard.html'; return; }
  $('#imp').innerHTML = `<div class="panel"><h3>Reprendre une liste existante</h3>
    <ol style="margin:0 0 14px;padding-left:20px;line-height:1.9">
      <li>Téléchargez le modèle et remplissez-le dans Excel (une ligne par membre, seule la colonne « nom_prenoms » est obligatoire).</li>
      <li>Enregistrez le fichier au format <b>CSV</b> (Fichier > Enregistrer sous > CSV).</li>
      <li>Choisissez le fichier ci-dessous : un aperçu s'affiche avant tout enregistrement.</li></ol>
    <div class="bar"><button class="btn ghost" id="mod" data-ico="download">Télécharger le modèle</button><input type="file" id="fic" accept=".csv,.txt,text/csv"></div>
    <p style="color:var(--mut);margin:0">Les membres importés n'ont pas de photo ni de consentement enregistré : à compléter ensuite sur leur fiche. Les doublons (même nom et même téléphone) sont ignorés.</p></div><div id="prev"></div>`;
  decorate();
  $('#mod').onclick = () => downloadCSV('modele-import-membres.csv', Object.keys(LIBELLES).map(k => k === 'nom_prenoms' ? k : k), [
    ['Kouassi Jean (exemple)', 'M', '15/03/1990', '0707070707', 'Cocody', 'Abidjan', '12/01/2024', 'oui', 'non', ''],
    ['Yao Marie (exemple)', 'F', '02/11/1985', '0505050505', 'Yopougon', 'Marché', '03/03/2023', 'non', 'oui', '20/08/2023']]);
  $('#fic').onchange = e => run(async () => {
    const f = e.target.files[0]; if (!f) return;
    const buf = await f.arrayBuffer(); let t = new TextDecoder('utf-8').decode(buf);
    if (t.includes('\ufffd')) t = new TextDecoder('windows-1252').decode(buf);   // CSV Excel classique
    const rows = parseCSV(t);
    if (rows.length < 2) return toast('Le fichier est vide ou ne contient que les en-têtes.', 'bad');
    const { cols, inconnues } = detectCols(rows[0]);
    if (cols.nom_prenoms === undefined) { $('#prev').innerHTML = '<div class="panel"><p class="empty">Colonne du nom introuvable. La première ligne doit contenir un en-tête « nom_prenoms » (ou « Nom »).</p></div>'; return; }
    const existing = (await fetchAll(() => sb.from('membres').select('nom_prenoms,telephone').order('id'))).map(m => cle(m.nom_prenoms, m.telephone));
    const { ok, dup, err } = buildRows(rows, cols, existing);
    $('#prev').innerHTML = `<div class="panel"><h3>Aperçu avant import</h3>
      <p>Colonnes reconnues : ${Object.keys(cols).map(k => badge(LIBELLES[k], 'ok')).join(' ')}${inconnues.length ? `<br>Ignorées : ${inconnues.map(x => badge(x, 'w')).join(' ')}` : ''}</p>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><div class="stat ok"><b>${ok.length}</b><span>à importer</span></div><div class="stat w"><b>${dup.length}</b><span>doublons ignorés</span></div><div class="stat b"><b>${err.length}</b><span>lignes en erreur</span></div></div>
      ${err.length ? `<h3 style="margin-top:6px">Lignes en erreur (non importées)</h3>${table(['Ligne', 'Nom', 'Problème'], err.slice(0, 30).map(x => [x.line, esc(x.nom || '—'), esc(x.msg)]))}${err.length > 30 ? `<p class="empty">… et ${err.length - 30} autres.</p>` : ''}` : ''}
      ${ok.length ? `<h3 style="margin:14px 0 8px">Les premiers membres</h3>${table(['Nom et prénoms', 'Sexe', 'Naissance', 'Téléphone', 'Habitation', 'Baptisé'], ok.slice(0, 8).map(o => [esc(o.nom_prenoms), o.sexe || '—', fmtDate(o.date_naissance), esc(o.telephone || '—'), esc(o.lieu_habitation || '—'), o.baptise ? 'Oui' : 'Non']))}
      <div class="foot"><span></span><button class="btn" id="go">Importer ${ok.length} membre(s)</button></div>` : '<p class="empty">Rien à importer.</p>'}</div>`;
    if (!ok.length) return;
    $('#go').onclick = () => run(async () => {
      const btn = $('#go'); btn.disabled = true; let n = 0;
      try {
        for (let i = 0; i < ok.length; i += 100) {
          btn.textContent = `Import en cours… ${n}/${ok.length}`;
          const { error } = await sb.from('membres').insert(ok.slice(i, i + 100)); if (error) throw error; n += Math.min(100, ok.length - i);
        }
      } catch (x) { btn.disabled = false; btn.textContent = `Réessayer (${n} déjà importés)`; throw x; }
      $('#prev').innerHTML = `<div class="panel"><h3>Import terminé</h3><p>${n} membre(s) importé(s).</p><a class="btn" href="membres.html">Voir la liste des membres</a></div>`;
      toast(`${n} membre(s) importé(s).`);
    });
  });
});

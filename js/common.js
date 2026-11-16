/* ===== Socle commun : client Supabase, utilitaires, icônes, layout, calculs de présence ===== */
if (typeof supabase === 'undefined') {
  document.body.innerHTML = '<div style="font:16px system-ui;max-width:420px;margin:12vh auto;padding:24px;text-align:center"><h2>Chargement impossible</h2><p>Un fichier de l\'application n\'a pas pu être chargé. Vérifiez votre connexion Internet puis actualisez la page.</p><button onclick="location.reload()" style="padding:10px 18px;border:0;border-radius:10px;background:#006c69;color:#fff;font:inherit;cursor:pointer">Réessayer</button></div>';
  throw new Error('supabase non chargé');
}
const CFG = window.ADD_CONFIG;
/* Chaque requête réseau est limitée à 20 s : au-delà, on affiche un message clair au lieu de tourner indéfiniment */
const sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { db: { retry: false }, global: { fetch: (url, opts = {}) => {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 20000);
  if (opts.signal) opts.signal.addEventListener('abort', () => c.abort());
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
} } });
let ME = null;
const isNetErr = e => !navigator.onLine || e?.name === 'AbortError' || e?.name === 'AuthRetryableFetchError' || e?.status === 0
  || /failed to fetch|networkerror|network request failed|load failed|fetch failed|aborted|timeout/i.test(String(e?.message || e || ''));
const NET_MSG = "Pas de connexion Internet. Vérifiez votre réseau puis réessayez.";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const daysAgo = n => iso(new Date(Date.now() - n * 864e5));
const fmtDate = d => d ? d.split('-').reverse().join('/') : '—';
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const age = d => { if (!d) return ''; const b = new Date(d), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const waLink = t => { let n = String(t || '').replace(/\D/g, ''); if (n.length === 10) n = '225' + n; return n ? `https://wa.me/${n}` : ''; };
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* Export CSV lisible par Excel (UTF-8 avec BOM, séparateur ;) – neutralise les cellules qui ressemblent à une formule */
function downloadCSV(nom, entetes, lignes) {
  const q = v => { let t = String(v ?? ''); if (/^(=|@|[+\-](?![\d\s(]))/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const txt = '\ufeff' + [entetes, ...lignes].map(r => r.map(q).join(';')).join('\r\n');
  downloadBlob(nom, new Blob([txt], { type: 'text/csv;charset=utf-8' }));
}
/* Photo : redressée, réduite (1600 px max) et compressée en JPEG ; refusée seulement si elle dépasse encore 5 Mo.
   Le décodage passe par un élément <img> : c'est la méthode qui marche sur tous les téléphones et navigateurs. */
const PHOTO_MAX = 5 * 1024 * 1024;
async function preparePhoto(file, maxSide = 1600) {
  if (file.type && !file.type.startsWith('image/')) throw new Error("Ce fichier n'est pas une image.");
  let blob = null;
  try {
    let src = null, w = 0, h = 0, fin = () => {};
    /* Grosse photo d'appareil (12 à 50 mégapixels) : décodée directement en taille réduite, pour ne pas saturer la mémoire du téléphone */
    if (window.createImageBitmap && file.size > 1.2 * 1048576) {
      try { const bm = await createImageBitmap(file, { resizeWidth: maxSide, resizeQuality: 'medium' }); src = bm; w = bm.width; h = bm.height; fin = () => bm.close(); } catch (e) { src = null; }
    }
    if (!src) {
      const url = URL.createObjectURL(file);
      fin = () => URL.revokeObjectURL(url);
      try { src = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('decode')); i.src = url; }); w = src.naturalWidth; h = src.naturalHeight; }
      catch (e) { fin(); throw e; }
    }
    try {
      const k = Math.min(1, maxSide / Math.max(w, h));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height);
      for (const q of [.85, .7, .55, .4]) { blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q)); if (blob && blob.size <= PHOTO_MAX) break; }
      c.width = c.height = 0;                    // libère la mémoire du canevas tout de suite
    } finally { fin(); }
  } catch (e) { blob = null; }
  if (!blob) blob = file;                       // décodage impossible : on garde l'original s'il est assez léger
  if (blob.size > PHOTO_MAX) throw new Error(blob === file
    ? "Impossible de réduire cette photo automatiquement. Reprenez-la ou choisissez-en une plus légère (5 Mo maximum)."
    : `La photo dépasse encore 5 Mo (${(blob.size / 1048576).toFixed(1)} Mo).`);
  return blob;
}
/* Appareil photo intégré à l'application : photo légère (1280 px) prise sans ouvrir l'application Photo du téléphone,
   qui peut manquer de mémoire. Renvoie un Blob JPEG, null si annulé, undefined si la caméra intégrée n'est pas disponible. */
function takePhoto() {
  return new Promise((resolve, reject) => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) return resolve(undefined);
    const o = document.createElement('div'); o.className = 'overlay cam'; o.id = 'camera';
    o.innerHTML = `<div class="modal"><div class="mh"><h3>Prendre une photo</h3><button type="button" class="x" data-a="stop" aria-label="Fermer">${ico('x', 16)}</button></div>
      <div class="mb"><video playsinline muted autoplay></video><div class="foot"><button type="button" class="btn ghost" data-a="flip">Changer de caméra</button><button type="button" class="btn" data-a="shot">${ico('camera')}Capturer</button></div></div></div>`;
    const v = $('video', o); let stream = null, face = 'environment', fini = false;
    const fermer = r => { if (fini) return; fini = true; stream?.getTracks().forEach(t => t.stop()); document.removeEventListener('keydown', esc_, true); o.remove(); resolve(r); };
    const esc_ = e => { if (e.key === 'Escape') { e.stopPropagation(); fermer(null); } };    // Échap ferme la caméra, pas la fiche derrière
    const start = async () => {
      stream?.getTracks().forEach(t => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: face }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      if (fini) return stream.getTracks().forEach(t => t.stop());
      v.srcObject = stream; try { await v.play(); } catch (e) {}
    };
    const echec = e => { if (fini) return; fini = true; stream?.getTracks().forEach(t => t.stop()); document.removeEventListener('keydown', esc_, true); o.remove();
      reject(new Error(e?.name === 'NotAllowedError' ? "L'accès à la caméra est refusé. Autorisez-le dans les réglages du navigateur, ou utilisez « Galerie »." : "Caméra indisponible sur cet appareil. Utilisez « Galerie ».")); };
    o.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'stop') fermer(null);
      else if (a === 'flip') { face = face === 'environment' ? 'user' : 'environment'; start().catch(echec); }
      else if (a === 'shot') {
        const w = v.videoWidth, h = v.videoHeight; if (!w) return;
        const k = Math.min(1, 1280 / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(b => { c.width = c.height = 0; fermer(b); }, 'image/jpeg', .85);
      }
    });
    document.addEventListener('keydown', esc_, true); document.body.appendChild(o);
    start().catch(echec);
  });
}
function downloadBlob(nom, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
const badge = (t, c = '') => `<span class="badge ${c}">${esc(t)}</span>`;
const initials = n => String(n || '?').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const avatar = (m, cls = '') => m.photo_url ? `<img class="av ${cls}" src="${esc(m.photo_url)}" alt="">` : `<span class="av ${cls}">${esc(initials(m.nom_prenoms))}</span>`;
const lienMembre = m => `<a href="membre.html?id=${m.id}">${esc(m.nom_prenoms)}</a>`;
const table = (h, rows, empty = 'Aucune donnée') => rows.length
  ? `<div class="tw"><table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td data-label="${esc(String(h[i] ?? '').replace(/<[^>]*>/g, ''))}"${String(c).trim() === '' ? ' class="vide"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  : `<p class="empty">${empty}</p>`;
const bars = items => { const mx = Math.max(1, ...items.map(i => i.value)); return `<div class="chart">${items.map((i, k) => `<div><b>${i.value}</b><i style="height:${Math.round(i.value / mx * 100)}%;animation-delay:${k * 60}ms"></i><span>${esc(i.label)}</span></div>`).join('')}</div>`; };

/* Icônes (style trait fin) */
const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 4.7a3.5 3.5 0 010 6.6M18.5 14.3c1.8.8 3 2.7 3 5.7"/>',
  userplus: '<circle cx="10" cy="8" r="3.5"/><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6M19 8v6M16 11h6"/>',
  userx: '<circle cx="10" cy="8" r="3.5"/><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6M16 8.5l5 5M21 8.5l-5 5"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  chart: '<path d="M4 20V11M10 20V4M16 20v-7M22 20H2"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  bell: '<path d="M6 9a6 6 0 0112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 004 0"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
  clock: '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 21l5-3 5 3-1.5-7"/>',
  gift: '<rect x="3" y="10" width="18" height="11" rx="2"/><path d="M12 10v11M3 15h18"/><path d="M12 10C9.5 10 8 9 8 7.5S10 5 12 10zM12 10c2.5 0 4-1 4-2.5S14 5 12 10z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  cross: '<path d="M12 3v18M6.5 9h11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
  wifioff: '<path d="M2 8.8a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0"/><circle cx="12" cy="19.5" r=".8"/><path d="M3 3l18 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  wallet: '<path d="M4 7a2 2 0 012-2h11v3"/><rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="16.5" cy="13.5" r="1.2"/>'
};
const ico = (n, s = 18) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

function toast(msg, type = 'ok') {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = 'show ' + type; t.textContent = msg; clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 3200);
}
function openModal(title, body, opts = {}) {
  $('#modal')?.remove();
  const o = document.createElement('div'); o.className = 'overlay'; o.id = 'modal';
  o.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}"><div class="mh"><h3>${title}</h3><button class="x" onclick="closeModal()" aria-label="Fermer">${ico('x', 16)}</button></div><div class="mb">${body}</div></div>`;
  o.addEventListener('mousedown', e => { if (e.target === o) closeModal(); });
  document.body.appendChild(o); return o.querySelector('.mb');
}
function closeModal() { const o = $('#modal'); if (!o) return; o.id = ''; o.classList.add('out'); setTimeout(() => o.remove(), 170); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
async function run(fn) { try { await fn(); } catch (e) { console.error(e); toast(isNetErr(e) ? NET_MSG : (e.message || 'Une erreur est survenue'), 'bad'); } }

function formData(root) {
  const o = {};
  $$('[name]', root).forEach(el => o[el.name] = el.type === 'checkbox' ? el.checked : (el.value === '' ? null : el.value));
  return o;
}
function fillForm(root, obj) {
  $$('[name]', root).forEach(el => { const v = obj[el.name]; if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? ''; });
}

/* Lecture paginée (Supabase limite à 1000 lignes par requête) */
async function fetchAll(q) {
  let all = [], from = 0;
  for (;;) {
    const { data, error } = await q().range(from, from + 999);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

/* Paramètres de l'église (règle de régularité, etc.) */
const DEFAULTS = { nom_eglise: 'Âmes de Dieu', telephone: '', adresse: '', seuil_cultes: 6, seuil_cellules: 4, fenetre_jours: 90, jours_actif: 30 };
async function getParam() {
  const { data, error } = await sb.from('parametres').select('*');
  if (error && isNetErr(error)) throw error;
  const P = { ...DEFAULTS };
  (data || []).forEach(r => P[r.cle] = ['seuil_cultes', 'seuil_cellules', 'fenetre_jours', 'jours_actif'].includes(r.cle) ? Number(r.valeur) : r.valeur);
  return P;
}

/* Calcul automatique des présences : cultes et cellules ont des dates différentes, comptés séparément */
const emptyAtt = () => ({ culte: { present: 0, absent: 0, excuse: 0 }, cellule: { present: 0, absent: 0, excuse: 0 }, win: { culte: 0, cellule: 0 }, last: null, activeRecent: false });
function computeAttendance(presences, P) {
  const M = {}, lim = daysAgo(P.fenetre_jours), limA = daysAgo(P.jours_actif);
  for (const x of presences) {
    if (!x.reunions) continue;
    const k = x.reunions.type === 'culte' ? 'culte' : 'cellule';
    const m = M[x.membre_id] ||= emptyAtt();
    m[k][x.statut]++;
    if (x.statut === 'present') {
      const d = x.reunions.date;
      if (!m.last || d > m.last) m.last = d;
      if (d >= lim) m.win[k]++;
      if (d >= limA) m.activeRecent = true;
    }
  }
  return M;
}
const isRegular = (a, P) => a.win.culte >= P.seuil_cultes && a.win.cellule >= P.seuil_cellules;
const regStatus = (a, P) => !a.activeRecent ? ['À relancer', 'b'] : isRegular(a, P) ? ['Régulier', 'ok'] : ['Occasionnel', 'w'];

/* Chargeurs de données partagés entre plusieurs pages */
async function loadPresenceData(P) {
  const [MEM, CEL, REU, PRES] = await Promise.all([
    fetchAll(() => sb.from('membres').select('id,matricule,nom_prenoms,cellule_id,photo_url,telephone').eq('archive', false).order('nom_prenoms').order('id')),
    fetchAll(() => sb.from('cellules').select('*').order('nom')),
    fetchAll(() => sb.from('reunions').select('*').order('date', { ascending: false }).order('id')),
    fetchAll(() => sb.from('presences').select('id,membre_id,reunion_id,statut,observation,reunions(date,type)').order('id'))]);
  return { MEM, CEL, REU, PRES, ATT: computeAttendance(PRES, P) };
}
function countsByReunion(PRES) {
  const c = {}; PRES.forEach(p => { const o = c[p.reunion_id] ||= { present: 0, absent: 0, excuse: 0 }; o[p.statut]++; }); return c;
}
const DEC = { selectionne: ['Sélectionné, en attente de validation', 'w'], valide: ['Validé par le pastorat', 'ok'], ajourne: ['Ajourné', 'b'] };
async function loadBapData(P, withAtt = true) {
  const [MEM, BAP, p] = await Promise.all([
    fetchAll(() => sb.from('membres').select('*').eq('archive', false).order('nom_prenoms').order('id')),
    fetchAll(() => sb.from('baptemes').select('*').order('id')),
    withAtt ? fetchAll(() => sb.from('presences').select('membre_id,statut,reunions(date,type)').order('id')) : Promise.resolve([])]);
  return { MEM, BAP, ATT: computeAttendance(p, P) };
}

/* Historique d'un membre */
async function logH(membre_id, action, detail = '') {
  await sb.from('historique').insert({ membre_id, action, detail, auteur: ME?.nom || ME?.username });
}

/* Session et rôles */
async function requireAuth() {
  const { data: { session }, error } = await sb.auth.getSession();
  if (error && isNetErr(error)) throw error;               // réseau coupé : on ne redirige pas, on prévient
  if (!session) { location.href = '../index.html'; return null; }
  const { data: p, error: pe } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (pe && isNetErr(pe)) throw pe;
  if (!p || !p.actif) { await sb.auth.signOut({ scope: 'local' }); location.href = '../index.html'; return null; }
  return ME = p;
}
const isAdmin = () => ME?.role === 'admin';
const isResp = () => ['admin', 'responsable'].includes(ME?.role);
async function logout() { localStorage.removeItem('add_me'); try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {} location.href = '../index.html'; }

/* Caisse : outils partagés (page Caisse, tableau de bord, rapports) */
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
let DEV = 'FCFA';
const money = n => nf.format(n) + '\u00a0' + DEV;
const moneyHtml = n => `${nf.format(n)}<small> ${esc(DEV)}</small>`;
const r2 = n => Math.round(n * 100) / 100;
const caisseTotal = (rows, sens) => r2(rows.filter(x => x.sens === sens).reduce((t, x) => t + Number(x.montant), 0));
const sensBadge = s => s === 'entree' ? badge('Entrée', 'ok') : badge('Sortie', 'b');
/* Lignes de la caisse jusqu'à d2 (toutes si omis). Renvoie null pour un serviteur ou si 03_caisse.sql n'est pas installé :
   les pages qui affichent la caisse restent alors identiques à avant. Fixe aussi la devise (DEV). */
async function loadCaisse(d1, d2) {
  if (!isResp()) return null;
  try {
    const rows = await fetchAll(() => { let q = sb.from('caisse').select('*'); if (d1) q = q.gte('date', d1); if (d2) q = q.lte('date', d2); return q.order('date').order('id'); });
    const { data } = await sb.from('parametres').select('valeur').eq('cle', 'devise').maybeSingle();
    if (data?.valeur) DEV = data.valeur;
    return rows;
  } catch (e) { console.warn('Caisse indisponible', e); return null; }
}

/* Menu latéral groupé : chaque entrée est une page entière (4e valeur = réservé à l'administrateur) */
const MENU = [
  ['Général', [['dashboard', 'Tableau de bord', 'home']]],
  ['Membres', [['membres', 'Liste des membres', 'users'], ['import', 'Importer des membres', 'upload', 'admin'], ['anniversaires', 'Anniversaires', 'gift']]],
  ['Participation', [['presences', 'Cultes et cellules', 'check'], ['synthese', 'Synthèse par membre', 'list'], ['statistiques', 'Statistiques', 'chart'], ['cellules', 'Cellules', 'grid']]],
  ['Suivi pastoral', [['a-visiter', 'À visiter', 'bell'], ['visites', 'Visites', 'pin']]],
  ['Baptême', [['candidats-bapteme', 'Candidats', 'drop'], ['suivi-bapteme', 'Suivi et décisions', 'clock'], ['baptises', 'Personnes baptisées', 'award']]],
  ['Église', [['evenements', 'Événements', 'calendar'], ['rapports', 'Rapports', 'file']]],
  ['Finances', [['caisse', 'Caisse', 'wallet', 'resp']]],
  ['Administration', [['parametres', 'Paramètres', 'sliders'], ['utilisateurs', 'Utilisateurs', 'userplus', 'admin']]]
];
const ROLES = { admin: 'Administrateur', responsable: 'Responsable', serviteur: 'Serviteur' };
const SUBS = {
  'Tableau de bord': "Vue d'ensemble de la vie de l'église", 'Membres': 'Tous les membres, du premier contact à l\'intégration', 'Fiche membre': 'Toutes les informations du membre au même endroit',
  'Cultes et cellules': 'Créez un culte ou une cellule, pointez les présences, cliquez sur une date pour le détail', 'Synthèse par membre': 'Présences et absences de chacun, cultes et cellules séparés', 'Statistiques de participation': 'Effectifs et taux de présence',
  'Cellules': 'Les groupes de maison et leurs responsables', 'Visites': 'Historique des visites effectuées', 'Membres à visiter': 'Membres absents à visiter et visites planifiées',
  'Candidats au baptême': 'Membres réguliers prêts à être proposés', 'Suivi des baptêmes': 'Décisions après validation pastorale', 'Personnes baptisées': 'Registre des baptêmes',
  'Anniversaires': 'Par mois ou par semaine', 'Événements et programmes': 'Calendrier et comptes rendus', 'Caisse': "Quêtes, offrandes et dépenses de l'église", 'Rapports et statistiques': 'Bilans mensuels et annuels', 'Paramètres': 'Votre compte et les règles de suivi', 'Utilisateurs': 'Comptes et droits d\'accès', 'Importer des membres': 'Reprendre une liste existante (fichier CSV Excel)'
};

/* Installation : bouton « Installer l'application » (Android, ordinateur) ou mode d'emploi (iPhone) */
let _installEv = null;
const _standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const _ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
function showInstall() { $$('[data-install]').forEach(el => { el.hidden = _standalone() || !(_installEv || _ios()); }); }
async function doInstall() {
  if (_installEv) { _installEv.prompt(); try { await _installEv.userChoice; } catch (e) {} _installEv = null; showInstall(); }
  else if (_ios()) openModal("Installer l'application", `<ol style="line-height:2;padding-left:20px;margin:0">
    <li>Dans Safari, touchez le bouton <b>Partager</b> (le carré avec une flèche vers le haut).</li>
    <li>Faites défiler et touchez <b>Sur l'écran d'accueil</b>.</li><li>Touchez <b>Ajouter</b> : l'icône apparaît comme une vraie application.</li></ol>`);
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _installEv = e; showInstall(); });
window.addEventListener('appinstalled', () => { _installEv = null; showInstall(); toast('Application installée.'); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register((location.pathname.includes('/pages/') ? '../' : '') + 'sw.js').catch(() => {}));

function renderSide(page) {
  const u = ME || JSON.parse(localStorage.getItem('add_me') || 'null'), adm = u?.role === 'admin', resp = ['admin', 'responsable'].includes(u?.role);
  const y = $('#sidebar nav')?.scrollTop ?? +(sessionStorage.getItem('sideY') || 0);
  $('#sidebar').innerHTML = `<div class="brand"><img src="../img/logo-banniere.png" alt="Vases d'Honneur"><small>ADD · Suivi des membres</small></div>
    <nav>${MENU.map(([g, items]) => { const its = items.filter(i => !i[3] || (i[3] === 'admin' ? adm : resp)); return its.length ? `<div class="grp">${g}</div>` + its.map(([k, l, i]) => `<a href="${k}.html" class="${k === page ? 'on' : ''}">${ico(i)}<span>${l}</span></a>`).join('') : ''; }).join('')}</nav>
    <div class="inst" data-install hidden><button class="btn" onclick="doInstall()">${ico('download')}Installer l'application</button></div>
    <div class="usr">${u ? `<span class="av sm">${esc(initials(u.nom || u.username))}</span><div><b>${esc(u.nom || u.username)}</b><small>${esc(ROLES[u.role] || '')}</small></div>` : '<div></div>'}<button onclick="logout()" title="Se déconnecter" aria-label="Se déconnecter">${ico('logout')}</button></div>`;
  $('#sidebar nav').scrollTop = y; showInstall();
}
const decorate = () => $$('[data-ico]').forEach(e => { if (!e.dataset.done) { e.insertAdjacentHTML('afterbegin', ico(e.dataset.ico)); e.dataset.done = 1; } });
function countUp(root = document) {
  $$('[data-n]', root).forEach(el => { const n = +el.dataset.n, t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / 800); el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
}

/* Réseau : bandeau permanent + écran explicite quand une page ne peut pas se charger */
function netBanner(off) {
  let b = $('#netbar'); if (!b) { b = document.createElement('div'); b.id = 'netbar'; document.body.appendChild(b); }
  b.innerHTML = ico('wifioff') + 'Pas de connexion Internet<span class="nb-long"> : les données ne peuvent être ni chargées ni enregistrées.</span>';
  document.body.classList.toggle('offline', off);
}
function offlineScreen() {
  window._offlineScreen = true;
  const c = $('#content') || document.body;
  c.innerHTML = `<div class="offline-card"><div class="oi">${ico('wifioff', 34)}</div><h2>Pas de connexion Internet</h2>
    <p>L'application a besoin du réseau pour afficher et enregistrer les données. Vérifiez votre Wi-Fi ou vos données mobiles.<br>Vos informations sont en sécurité et rien n'a été perdu.</p>
    <button class="btn" onclick="location.reload()">Réessayer</button><small>La page se rechargera toute seule dès que la connexion revient.</small></div>`;
}
window.addEventListener('offline', () => netBanner(true));
window.addEventListener('online', () => { netBanner(false); if (window._offlineScreen) location.reload(); else toast('Connexion rétablie'); });
if (!navigator.onLine) netBanner(true);

async function boot(page, title, fn) {
  const pb = document.createElement('div'); pb.id = 'progress'; document.body.appendChild(pb);
  renderSide(page);
  $('#topbar').innerHTML = `<button class="burger" onclick="document.body.classList.toggle('menu')" aria-label="Menu">${ico('menu', 22)}</button><div class="ttl"><h1>${title}</h1><p>${SUBS[title] || ''}</p></div><span class="date">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>`;
  decorate();
  try {
    if (!navigator.onLine) throw new TypeError('Failed to fetch');   // appareil hors réseau : message immédiat
    if (!await requireAuth()) return;
    localStorage.setItem('add_me', JSON.stringify({ nom: ME.nom, username: ME.username, role: ME.role }));
    renderSide(page);
    await fn();
  } catch (e) {
    console.error(e);
    if (isNetErr(e)) { netBanner(true); offlineScreen(); } else toast(e.message || 'Une erreur est survenue', 'bad');
  }
  decorate(); countUp(); pb.classList.add('done'); setTimeout(() => pb.remove(), 800);
}

/* Transition douce entre les pages : le contenu s'efface, le menu reste en place */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]'); if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (!/\.html(\?|#|$)/.test(a.getAttribute('href'))) return;
  e.preventDefault(); sessionStorage.setItem('sideY', $('#sidebar nav')?.scrollTop || 0);
  document.body.classList.add('leaving'); document.body.classList.remove('menu');
  setTimeout(() => location.href = a.href, 170);
});
window.addEventListener('pageshow', () => document.body.classList.remove('leaving'));

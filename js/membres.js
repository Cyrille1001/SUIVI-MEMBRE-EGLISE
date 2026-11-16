let MEMBRES = [], CELS = [];
boot('membres', 'Membres', async () => {
  await reload();
  $('#q').oninput = $('#fs').onchange = $('#fb').onchange = render;
  $('#add').onclick = () => edit(); $('#exp').onclick = exportCSV;
  const e = new URLSearchParams(location.search).get('edit'); if (e === 'new') edit(); else if (e) edit(e);
});

async function reload() {
  [MEMBRES, CELS] = await Promise.all([
    fetchAll(() => sb.from('membres').select('*').order('nom_prenoms').order('id')),
    fetchAll(() => sb.from('cellules').select('id,nom').order('nom'))]);
  render();
}

function filtered() {
  const q = $('#q').value.trim().toLowerCase(), fs = $('#fs').value, fb = $('#fb').value;
  return MEMBRES.filter(m =>
    (fs === 'tous' || (fs === 'archives') === !!m.archive) &&
    (!fb || (fb === 'oui') === !!m.baptise) &&
    (!q || [m.nom_prenoms, m.matricule, m.telephone, m.lieu_habitation, m.lieu_travail].join(' ').toLowerCase().includes(q)));
}

function exportCSV() {
  const cn = Object.fromEntries(CELS.map(c => [c.id, c.nom])), L = filtered();
  if (!L.length) return toast('Aucune fiche à exporter.', 'bad');
  downloadCSV(`membres-${today()}.csv`, ['Matricule', 'Nom et prénoms', 'Sexe', 'Date de naissance', 'Téléphone', 'Habitation', 'Travail', 'Cellule', 'Intégration', 'Nouveau converti', 'Baptisé', 'Date du baptême'],
    L.map(m => [m.matricule, m.nom_prenoms, m.sexe, fmtDate(m.date_naissance), m.telephone, m.lieu_habitation, m.lieu_travail, cn[m.cellule_id], fmtDate(m.date_integration), m.nouveau_converti ? 'Oui' : 'Non', m.baptise ? 'Oui' : 'Non', fmtDate(m.date_bapteme)]));
  toast(`${L.length} fiche(s) exportée(s).`);
}

function render() {
  const q = $('#q').value.trim().toLowerCase(), fs = $('#fs').value, fb = $('#fb').value;
  const cn = Object.fromEntries(CELS.map(c => [c.id, c.nom]));
  const rows = filtered()
    .map(m => [
      `<div class="who">${avatar(m)}<div>${lienMembre(m)}<br><small>${esc(m.matricule)}</small></div></div>`,
      m.sexe || '—', esc(m.telephone || '—'), esc(m.lieu_habitation || '—'), esc(cn[m.cellule_id] || '—'),
      [m.baptise ? badge('Baptisé', 'ok') : '', m.nouveau_converti ? badge('Nouveau converti', 'g') : '', m.archive ? badge('Archivé', 'b') : ''].join(' '),
      `<button class="btn sm ghost" onclick="edit('${m.id}')">Modifier</button><button class="btn sm ghost" onclick="histo('${m.id}')">Historique</button>` +
      (isResp() ? `<button class="btn sm ${m.archive ? '' : 'red'}" onclick="archive('${m.id}',${!m.archive})">${m.archive ? 'Restaurer' : 'Archiver'}</button>` : '')]);
  $('#list').innerHTML = `<p style="margin:0 0 8px;color:var(--mut)">${rows.length} fiche(s)</p>` + table(['Membre', 'Sexe', 'Téléphone', 'Habitation', 'Cellule', 'Statut', 'Actions'], rows, 'Aucun membre trouvé.');
}

let PHOTO = null;
function edit(id) {
  PHOTO = null;
  const m = id ? MEMBRES.find(x => x.id === id) : { date_integration: today() };
  if (!m) return;
  const b = openModal(id ? `Modifier la fiche · ${esc(m.matricule)}` : 'Nouveau membre', `
    <div class="fg">
      <label class="f full"><span>Nom et prénoms *</span><input name="nom_prenoms"></label>
      <label class="f"><span>Sexe</span><select name="sexe"><option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option></select></label>
      <label class="f"><span>Date de naissance</span><input type="date" name="date_naissance"></label>
      <label class="f"><span>Téléphone</span><input name="telephone" type="tel"></label>
      <label class="f"><span>Date d'intégration à l'église</span><input type="date" name="date_integration"></label>
      <label class="f"><span>Lieu d'habitation</span><input name="lieu_habitation"></label>
      <label class="f"><span>Lieu de travail</span><input name="lieu_travail"></label>
      <label class="f full"><span>Cellule</span><select name="cellule_id"><option value="">Aucune</option>${CELS.map(c => `<option value="${c.id}">${esc(c.nom)}</option>`).join('')}</select></label>
      <label class="f chk"><input type="checkbox" name="nouveau_converti"> Nouveau converti</label>
      <label class="f chk"><input type="checkbox" name="souhaite_membre"> Souhaite devenir membre de l'église</label>
      <label class="f chk"><input type="checkbox" name="baptise" id="bp"> Est baptisé</label>
      <label class="f" id="dbp"><span>Date du baptême</span><input type="date" name="date_bapteme"></label>
      <div class="full" style="margin-bottom:12px"><span style="display:block;font-size:13px;color:var(--mut);font-weight:500;margin-bottom:6px">Photo</span>
        <div class="who" style="flex-wrap:wrap">${m.photo_url ? `<img id="pprev" class="av" style="width:76px;height:76px" src="${esc(m.photo_url)}" alt="">` : `<span id="pprev" class="av" style="width:76px;height:76px;font-size:24px">${esc(initials(m.nom_prenoms) || '?')}</span>`}
          <button type="button" class="btn" id="pcam">${ico('camera')}Prendre une photo</button><button type="button" class="btn ghost" id="pgal">${ico('image')}Galerie</button>
          <input type="file" id="photo" accept="image/*" capture="environment" hidden><input type="file" id="photoG" accept="image/*" hidden></div>
        <small id="pinfo" style="color:var(--mut)">5 Mo maximum. Le consentement doit être coché pour enregistrer la photo.</small></div>
      <label class="f chk full"><input type="checkbox" name="consentement"> La personne consent à la collecte et à l'utilisation de ses informations personnelles et de sa photo</label>
    </div>
    <div class="foot"><span></span><button class="btn" id="save">Enregistrer</button></div>`, { wide: true });
  fillForm(b, m);
  let purl = null;
  const setPhoto = blob => {
    PHOTO = blob; if (purl) URL.revokeObjectURL(purl); purl = URL.createObjectURL(PHOTO);
    $('#pprev', b).outerHTML = `<img id="pprev" class="av" style="width:76px;height:76px" src="${purl}" alt="">`;
    $('#pinfo', b).textContent = `Photo prête (${(PHOTO.size / 1048576).toFixed(1)} Mo). Pensez à enregistrer la fiche.`;
  };
  const pick = inp => inp.onchange = () => run(async () => {
    const f = inp.files[0]; if (!f) return;
    const nouvelle = await preparePhoto(f); inp.value = ''; setPhoto(nouvelle);
  });
  pick($('#photo', b)); pick($('#photoG', b));
  /* « Prendre une photo » : caméra intégrée (légère) ; si elle n'est pas disponible, appareil photo du téléphone */
  $('#pcam', b).onclick = () => run(async () => {
    const blob = await takePhoto();
    if (blob === undefined) return $('#photo', b).click();
    if (blob) setPhoto(blob);
  });
  $('#pgal', b).onclick = () => $('#photoG', b).click();
  const tog = () => $('#dbp', b).style.display = $('#bp', b).checked ? '' : 'none'; tog(); $('#bp', b).onchange = tog;
  $('#save', b).onclick = () => run(() => save(m, b));
}

async function save(old, b) {
  const d = formData(b);
  if (!d.nom_prenoms) return toast('Le nom et prénoms sont obligatoires.', 'bad');
  const file = PHOTO;
  if (file && !d.consentement) return toast('Le consentement est requis pour enregistrer la photo.', 'bad');
  if (d.date_naissance && d.date_naissance > today()) return toast('La date de naissance ne peut pas être dans le futur.', 'bad');
  if (!old.id) {
    const tel = (d.telephone || '').replace(/\D/g, '');
    const dup = MEMBRES.find(x => norm(x.nom_prenoms) === norm(d.nom_prenoms) || (tel.length >= 8 && (x.telephone || '').replace(/\D/g, '') === tel));
    if (dup && !confirm(`Une fiche existe déjà : ${dup.nom_prenoms} (${dup.matricule}). Créer quand même un nouveau membre ?`)) return;
  }
  if (d.baptise && !d.date_bapteme) return toast('Indiquez la date du baptême.', 'bad');
  if (!d.baptise) d.date_bapteme = null;
  d.consentement_date = d.consentement ? (old.consentement_date || today()) : null;
  let row;
  if (old.id) { const r = await sb.from('membres').update(d).eq('id', old.id).select().single(); if (r.error) throw r.error; row = r.data; await logH(row.id, 'Fiche modifiée'); }
  else { const r = await sb.from('membres').insert(d).select().single(); if (r.error) throw r.error; row = r.data; await logH(row.id, 'Fiche créée', `Matricule ${row.matricule}`); }
  if (file) {
    const ext = file.type === 'image/jpeg' ? 'jpg' : (file.type.split('/')[1] || 'jpg').replace('+xml', '');
    const path = `${row.id}.${ext}`;
    const up = await sb.storage.from('photos').upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) throw up.error;
    await sb.from('membres').update({ photo_url: sb.storage.from('photos').getPublicUrl(path).data.publicUrl + '?v=' + Date.now() }).eq('id', row.id);
  }
  closeModal(); toast(old.id ? 'Fiche mise à jour.' : `Membre enregistré · matricule ${row.matricule}`); await reload();
}

async function archive(id, flag) {
  await run(async () => {
    if (flag && !confirm('Archiver cette fiche ? Elle ne sera plus comptée dans les statistiques.')) return;
    const { error } = await sb.from('membres').update({ archive: flag, archive_date: flag ? today() : null }).eq('id', id);
    if (error) throw error;
    await logH(id, flag ? 'Fiche archivée' : 'Fiche restaurée'); toast(flag ? 'Fiche archivée.' : 'Fiche restaurée.'); await reload();
  });
}

async function histo(id) {
  await run(async () => {
    const { data, error } = await sb.from('historique').select('*').eq('membre_id', id).order('created_at', { ascending: false });
    if (error) throw error;
    openModal('Historique du membre', table(['Date', 'Action', 'Détail', 'Par'], data.map(h => [fmtDate(h.created_at.slice(0, 10)), esc(h.action), esc(h.detail || ''), esc(h.auteur || '')]), 'Aucun historique.'));
  });
}

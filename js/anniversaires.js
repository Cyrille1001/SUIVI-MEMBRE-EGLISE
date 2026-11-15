let MEM = [];
boot('anniversaires', 'Anniversaires', async () => {
  MEM = await fetchAll(() => sb.from('membres').select('id,nom_prenoms,date_naissance,telephone,photo_url').eq('archive', false).not('date_naissance', 'is', null).order('id'));
  $('#mo').innerHTML = MOIS.map((m, i) => `<option value="${i + 1}">${m[0].toUpperCase() + m.slice(1)}</option>`).join('');
  $('#mo').value = new Date().getMonth() + 1;
  $('#wk').innerHTML = '<option value="">Tout le mois</option><option value="cur">Cette semaine</option><option value="1">Semaine 1 (1–7)</option><option value="2">Semaine 2 (8–14)</option><option value="3">Semaine 3 (15–21)</option><option value="4">Semaine 4 (22–28)</option><option value="5">Semaine 5 (29–fin)</option>';
  $('#mo').onchange = $('#wk').onchange = render; render();
});
function render() {
  const mo = +$('#mo').value, wk = $('#wk').value, now = new Date();
  $('#ttl').textContent = 'Anniversaires de ' + MOIS[mo - 1];
  let ok = () => true;
  if (wk === 'cur') { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const set = new Set(Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return `${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; })); ok = m => set.has(m.date_naissance.slice(5)); }
  const rows = MEM.filter(m => wk === 'cur' ? ok(m) : +m.date_naissance.slice(5, 7) === mo && (!wk || (+m.date_naissance.slice(8) >= (wk - 1) * 7 + 1 && (wk == 5 || +m.date_naissance.slice(8) <= wk * 7))))
    .sort((a, b) => a.date_naissance.slice(5).localeCompare(b.date_naissance.slice(5)))
    .map(m => { const j = +m.date_naissance.slice(8), mm = +m.date_naissance.slice(5, 7), isToday = j === now.getDate() && mm === now.getMonth() + 1;
      return [`${j} ${MOIS[mm - 1]} ${isToday ? badge('Aujourd\'hui', 'g') : ''}`, `<div class="who">${avatar(m)}${lienMembre(m)}</div>`, `${now.getFullYear() - +m.date_naissance.slice(0, 4)} ans`, esc(m.telephone || '—'), waLink(m.telephone) ? `<a class="btn sm ghost" href="${waLink(m.telephone)}" target="_blank" rel="noopener">Souhaiter par WhatsApp</a>` : '']; });
  $('#list').innerHTML = table(['Date', 'Membre', 'Âge fêté', 'Téléphone', ''], rows, 'Aucun anniversaire sur cette période.');
}

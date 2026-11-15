let MEM = [], ATT = {}, P;
boot('synthese', 'Synthèse par membre', async () => { P = await getParam(); const d = await loadPresenceData(P); MEM = d.MEM; ATT = d.ATT; drawSyn(); });

function drawSyn() {
  $('#pane-syn').innerHTML = `<div class="bar"><input id="sq" placeholder="Rechercher un membre…"><select id="sf"><option value="">Tous les membres</option><option value="Régulier">Réguliers</option><option value="Occasionnel">Occasionnels</option><option value="À relancer">À relancer (ne viennent plus)</option></select></div>
    <p style="color:var(--mut);margin-top:0">Règle : « régulier » = au moins ${P.seuil_cultes} cultes et ${P.seuil_cellules} cellules sur ${P.fenetre_jours} jours ; « à relancer » = aucune présence depuis ${P.jours_actif} jours. Modifiable dans Paramètres.</p><div class="panel" id="sl"></div>`;
  const list = () => {
    const q = $('#sq').value.toLowerCase(), f = $('#sf').value;
    $('#sl').innerHTML = table(['Membre', 'Cultes (présences / absences)', 'Cellules (présences / absences)', 'Dernière présence', 'Statut'],
      MEM.map(m => ({ m, a: ATT[m.id] || emptyAtt() })).filter(({ m, a }) => m.nom_prenoms.toLowerCase().includes(q) && (!f || regStatus(a, P)[0] === f))
        .map(({ m, a }) => [lienMembre(m), `${a.culte.present} / ${a.culte.absent}${a.culte.excuse ? ` (${a.culte.excuse} excusé)` : ''}`, `${a.cellule.present} / ${a.cellule.absent}${a.cellule.excuse ? ` (${a.cellule.excuse} excusé)` : ''}`, fmtDate(a.last), badge(...regStatus(a, P))]), 'Aucun membre.');
  };
  $('#sq').oninput = $('#sf').onchange = list; list();
}


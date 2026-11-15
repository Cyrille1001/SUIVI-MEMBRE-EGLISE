/* Si une session existe, le tableau de bord la valide (il ne renvoie ici que si elle est vraiment invalide) */
sb.auth.getSession().then(({ data, error }) => { if (data?.session && !error) location.href = 'pages/dashboard.html'; });
$('#f').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#err'), btn = $('#f .btn'); err.textContent = '';
  if (!navigator.onLine) { err.textContent = 'Pas de connexion Internet. Vérifiez votre réseau puis réessayez.'; return; }
  btn.disabled = true; btn.textContent = 'Connexion…';
  let error;
  try { ({ error } = await sb.auth.signInWithPassword({ email: $('#u').value.trim().toLowerCase() + '@' + CFG.EMAIL_DOMAIN, password: $('#p').value })); }
  catch (x) { error = x; }
  if (error) {
    err.textContent = isNetErr(error) ? 'Impossible de joindre le serveur. Vérifiez votre connexion Internet puis réessayez.' : "Nom d'utilisateur ou mot de passe incorrect.";
    btn.disabled = false; btn.textContent = 'Se connecter'; return;
  }
  location.href = 'pages/dashboard.html';
});
window.addEventListener('offline', () => $('#err').textContent = 'Pas de connexion Internet.');
window.addEventListener('online', () => $('#err').textContent = '');

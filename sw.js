/* ADD – service worker : rend l'application installable et garde une copie des pages pour un chargement plus rapide.
   Les données (Supabase) ne sont JAMAIS mises en cache : elles passent toujours par le réseau. */
const VERSION = 'add-v17';
const FICHIERS = ["./", "css/style.css", "img/banniere.jpg", "img/eglise.jpg", "img/icone-180.png", "img/icone-192.png", "img/icone-512.png", "img/icone-maskable-512.png", "img/logo-banniere.png", "img/logo.png", "index.html", "js/a-visiter.js", "js/anniversaires.js", "js/baptises.js", "js/caisse.js", "js/candidats-bapteme.js", "js/cellules.js", "js/common.js", "js/config.js", "js/dashboard.js", "js/evenements.js", "js/import.js", "js/login.js", "js/membre.js", "js/membres.js", "js/parametres.js", "js/presences.js", "js/rapports.js", "js/statistiques.js", "js/suivi-bapteme.js", "js/synthese.js", "js/utilisateurs.js", "js/vendor/supabase.js", "js/visites.js", "manifest.webmanifest", "pages/a-visiter.html", "pages/anniversaires.html", "pages/baptises.html", "pages/caisse.html", "pages/candidats-bapteme.html", "pages/cellules.html", "pages/dashboard.html", "pages/evenements.html", "pages/import.html", "pages/membre.html", "pages/membres.html", "pages/parametres.html", "pages/presences.html", "pages/rapports.html", "pages/statistiques.html", "pages/suivi-bapteme.html", "pages/synthese.html", "pages/utilisateurs.html", "pages/visites.html"];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => Promise.all(FICHIERS.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;      // Supabase et autres sites : réseau direct
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copie = res.clone(); caches.open(VERSION).then(c => c.put(r, copie)); } return res; })
    .catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

# ADD – Suivi des membres de l'Église (Âmes de Dieu)

Application web (HTML / CSS / JavaScript + Supabase). Ouvrir `index.html` via un petit serveur local
(extension « Live Server » de VS Code, ou `python -m http.server` dans ce dossier).
Connexion Internet requise pour les données (base Supabase). La bibliothèque Supabase est embarquée dans `js/vendor/`.
Sans réseau, l'application affiche un bandeau et un écran « Pas de connexion Internet » avec un bouton Réessayer,
et se recharge toute seule au retour de la connexion.

## Mise en route (une seule fois)
1. Créer le projet Supabase du client (nouveau compte au nom du client).
2. Supabase > SQL Editor : exécuter `sql/schema.sql`, puis `sql/02_roles.sql` (droits des rôles appliqués côté base).
3. Authentication > Providers > Email : **désactiver « Confirm email »**.
4. Project Settings > API : copier l'URL et la clé `anon` dans `js/config.js`.
5. Authentication > Users > Add user : `admin@add-app.com` + mot de passe (« Auto confirm user » coché).
   Ce premier compte devient administrateur ; connexion avec le nom `admin`.
6. Les autres comptes se créent dans l'application : Administration > Utilisateurs.
7. Pour reprendre une liste existante : Membres > Importer des membres (fichier CSV enregistré depuis Excel).
8. Photos : le bouton « Prendre une photo » ouvre directement la caméra du téléphone (5 Mo maximum, photo réduite automatiquement avant envoi).
9. Paramètres > Sauvegarde : télécharge toutes les données dans un fichier (à faire régulièrement).

## Structure
- `index.html` : connexion (seul fichier à la racine avec les dossiers)
- `pages/` : une page entière par entrée du menu (tableau de bord, membres, fiche membre, cultes et cellules,
  synthèse, statistiques, cellules, visites, à visiter, candidats, suivi des baptêmes, baptisés,
  anniversaires, événements, rapports, paramètres, utilisateurs)
- `js/vendor/` : bibliothèque Supabase (ne pas modifier)
- `js/common.js` : socle partagé (client Supabase, icônes, menu, transitions, calculs de présence)
- `js/<page>.js` : le code de chaque page · `css/style.css` : design · `sql/schema.sql` : base de données

- `img/` : logo et photos de l'église

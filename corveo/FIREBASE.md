# Corvéo · relier Firebase (une seule fois)

1. https://console.firebase.google.com → **Ajouter un projet** → nom « corveo » (Google Analytics : désactivé).
2. **Créer → Authentication → Commencer → E-mail/Mot de passe → Activer → Enregistrer.**
3. **Créer → Firestore Database → Créer une base de données** → emplacement en Europe → **mode production**.
4. Firestore → onglet **Règles** → remplacer tout par le contenu de `firestore.rules` → **Publier**.
5. ⚙️ **Paramètres du projet → Général → Vos applications → icône Web `</>`** → nom « corveo » → Enregistrer.
   Copier `apiKey` et `projectId` dans `src/config.js`.

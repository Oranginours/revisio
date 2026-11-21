// Configuration Firebase (le projet qui stocke les comptes et les familles).
// Ces deux valeurs ne sont pas secrètes : elles disent juste à l'appli quel projet utiliser.
// La sécurité vient des règles Firestore (voir FIREBASE.md).
export const FIREBASE = {
  apiKey: '',
  projectId: '',
};
export const configured = () => !!(FIREBASE.apiKey && FIREBASE.projectId);

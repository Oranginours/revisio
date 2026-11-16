// Dans le navigateur, Pronote refuse les connexions venant d'un autre site : on ne charge pas la bibliothèque.
export const createSessionHandle = () => { throw new Error("Pronote n'est pas disponible dans la version navigateur. Utilise l'appli Android."); };
export const TabLocation = {};

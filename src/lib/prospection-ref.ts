// Lien « Demander une dégustation » d’un e-mail de prospection : https://site/?pf=<jeton>#commande
// Le jeton est gardé le temps de la visite puis joint à la demande (champ ref) pour relier
// la demande au prospect dans l’espace admin. Aucune autre donnée n’est lue ni stockée.

const CLE = 'mf_ref';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function capturerRef(search: string = window.location.search): void {
  const ref = new URLSearchParams(search).get('pf') ?? '';
  if (!UUID.test(ref)) return;
  try {
    sessionStorage.setItem(CLE, ref.toLowerCase());
  } catch {
    /* stockage indisponible : la demande partira sans référence */
  }
}

export function lireRef(): string {
  try {
    const ref = sessionStorage.getItem(CLE) ?? '';
    return UUID.test(ref) ? ref : '';
  } catch {
    return '';
  }
}

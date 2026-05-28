// Base URL et helpers HTTP partagés entre tous les modules API.
// Centralisé ici pour éviter la duplication dans chaque fichier api/*.js
export const API_BASE = process.env.REACT_APP_API_URL
    || `http://${window.location.hostname}:8000/finances`;

// DD/MM/YYYY — seul format non-ISO accepté par formaterDateMidi côté backend.
// toISOString() donnerait une chaîne UTC avec 'Z', ce qui décalerait la date
// en timezone positive (ex. UTC+2 : 24/05 → 23/05T22:00Z).
export const formatDate = (date) => {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export const post = async (path, body) => {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Erreur serveur');
    return json;
};

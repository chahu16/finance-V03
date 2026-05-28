import { API_BASE, post } from './client.js';

// Mapping Backend → Frontend
const fromApi = (c) => ({
    id: c.id,
    nomCompte: c.nom,
    soldeInitial: c.soldeInitial,
    sommeDeCote: c.sommeDeCote,
    seuil: c.seuil,
    seuilOrange: c.seuilOrange,
    compteJoint: c.estCompteJoint,
    personnes: c.personnes ?? [],
    personneProprietaire: c.personneProprietaire ?? 0,
    archived: c.archive,
});

// Mapping Frontend → Backend
const toApi = (row) => ({
    id: row.id,
    nom: row.nomCompte,
    soldeInitial: row.soldeInitial ?? 0,
    sommeDeCote: row.sommeDeCote ?? 0,
    seuil: row.seuil ?? 0,
    seuilOrange: row.seuilOrange ?? 0,
    estCompteJoint: !!row.compteJoint,
    personnes: row.personnes ?? [],
    personneProprietaire: row.personneProprietaire ?? 0,
});

export const fetchComptes = async () => {
    const res = await fetch(`${API_BASE}/tableau-liste-comptes`);
    if (!res.ok) throw new Error('Erreur chargement comptes');
    return (await res.json()).map(fromApi);
};

export const saveCompte = async (row, isNew) => {
    const path = isNew ? '/ajout-compte' : '/modification-compte';
    const json = await post(path, toApi(row));
    return fromApi(json);
};

// Retourne 'archive' ou 'delete' selon la décision du backend
export const deleteCompte = async (row) => {
    const json = await post('/suppression-compte', { id: row.id });
    return json.action === 'archive' ? 'archive' : 'delete';
};

export const toggleArchiveCompte = async (id, archive) => {
    await post('/archiver-compte', { id, archive });
};

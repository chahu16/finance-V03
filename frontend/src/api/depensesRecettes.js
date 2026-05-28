import { API_BASE, formatDate, post } from './client.js';

// Mapping Backend → Frontend
// rembourser     → notesFraisRemboursee
// parts[0]       → pourcentageMoi
const fromApi = (doc) => ({
    id: doc.id,
    compte: doc.compte,
    dateDepensesRecettes: doc.dateDepensesRecettes ? new Date(doc.dateDepensesRecettes) : null,
    description: doc.description,
    depenses: doc.depenses ?? 0,
    recettes: doc.recettes ?? 0,
    noteDeFrais: !!doc.noteDeFrais,
    notesFraisRemboursee: !!(doc.rembourser ?? doc.notesFraisRemboursee),
    fraisFixe: !!doc.fraisFixe,
    chequeEnCours: !!doc.chequeEnCours,
    depenseRecettesAMasquer: !!doc.depenseRecettesAMasquer,
    pourcentageMoi: Array.isArray(doc.parts) && doc.parts.length > 0 ? doc.parts[0] : 50,
});

// Mapping Frontend → Backend
const toApi = (row) => ({
    id: row.id,
    compte: row.compte,
    dateDepensesRecettes: formatDate(row.dateDepensesRecettes),
    description: row.description,
    depenses: row.depenses ?? 0,
    recettes: row.recettes ?? 0,
    noteDeFrais: !!row.noteDeFrais,
    notesFraisRemboursee: !!row.notesFraisRemboursee,
    fraisFixe: !!row.fraisFixe,
    chequeEnCours: !!row.chequeEnCours,
    depenseRecettesAMasquer: !!row.depenseRecettesAMasquer,
    parts: [
        row.pourcentageMoi ?? 50,
        row.pourcentageMoi != null ? 100 - row.pourcentageMoi : 50,
    ],
});

// Les deux endpoints (comptes normaux + compte joint) sont chargés en parallèle
// et fusionnés dans le même état rows.
export const fetchDepensesRecettes = async () => {
    const [resNormal, resJoint] = await Promise.all([
        fetch(`${API_BASE}/liste-depenses-recettes`),
        fetch(`${API_BASE}/liste-compte-joint`),
    ]);
    if (!resNormal.ok) throw new Error('Erreur chargement dépenses/recettes');
    if (!resJoint.ok) throw new Error('Erreur chargement compte joint');
    const [normal, joint] = await Promise.all([resNormal.json(), resJoint.json()]);
    return [...normal, ...joint].map(fromApi);
};

// Les lignes auto-injectées (fraisFixe sans date) ont un id client (randomId),
// pas un ObjectId Mongo — on les traite comme de nouvelles entrées.
const isMongoId = (id) => /^[0-9a-f]{24}$/i.test(String(id ?? ''));

export const saveDepenseRecette = async (row, isNew) => {
    const shouldCreate = isNew || !isMongoId(row.id);
    const path = shouldCreate ? '/ajout-depense-recette' : '/modification-depense-recette';
    const json = await post(path, toApi(row));
    return fromApi(json);
};

export const deleteDepenseRecette = async (row) => {
    await post('/suppression-depense-recette', { id: row.id });
};

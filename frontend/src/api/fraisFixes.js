import { API_BASE, post } from './client.js';

// Normalise periodicite quel que soit la casse stockée en base
const PERIODICITE_MAP = {
    mensuel: 'Mensuel', trimestriel: 'Trimestriel',
    semestriel: 'Semestriel', annuel: 'Annuel',
    Mensuel: 'Mensuel', Trimestriel: 'Trimestriel',
    Semestriel: 'Semestriel', Annuel: 'Annuel',
};

// Normalise type quel que soit la casse (données importées via CSV bulk)
const TYPE_MAP = {
    depense: 'Dépense', recette: 'Recette',
    Dépense: 'Dépense', Recette: 'Recette',
};

// Mapping Backend → Frontend
// dateFraisFixe (Date complète) → jourPrelevement (entier)
//   Mensuel    : jour du mois  (1-31) = getDate()
//   Autres     : mois de référence (1-12) = getMonth() + 1
// Utilise les méthodes locales car le backend (dayjs sans timezone) et le
// browser partagent le même fuseau (déploiement Raspberry Pi domestique).
const fromApi = (doc) => {
    const periodicite = PERIODICITE_MAP[doc.periodicite] ?? doc.periodicite;
    const date = doc.dateFraisFixe ? new Date(doc.dateFraisFixe) : null;
    let jourPrelevement = 0;
    if (date && !isNaN(date.getTime())) {
        jourPrelevement = periodicite === 'Mensuel'
            ? date.getDate()
            : date.getMonth() + 1;
    }
    return {
        id: doc.id,
        compte: doc.compte,
        description: doc.description,
        jourPrelevement,
        type: TYPE_MAP[doc.type] ?? doc.type,
        montant: doc.montant,
        periodicite,
        pourcentageMoi: doc.parts?.[0] ?? null,
        archived: !!doc.archive,
    };
};

// Mapping Frontend → Backend
// jourPrelevement → chaîne ISO YYYY-MM-DD (pas d'objet Date pour éviter la conversion UTC)
const toApi = (row) => {
    const jourPrel = parseInt(row.jourPrelevement) || 1;
    const dateFraisFixe = row.periodicite === 'Mensuel'
        ? `2000-01-${String(jourPrel).padStart(2, '0')}`
        : `2000-${String(jourPrel).padStart(2, '0')}-01`;
    const pct = row.pourcentageMoi != null && row.pourcentageMoi !== '' ? parseFloat(row.pourcentageMoi) : null;
    return {
        id: row.id,
        compte: row.compte,
        description: row.description,
        dateFraisFixe,
        type: row.type,
        montant: row.montant,
        periodicite: row.periodicite,
        parts: pct != null && !isNaN(pct) ? [pct, 100 - pct] : [50, 50],
    };
};

export const fetchFraisFixes = async () => {
    const res = await fetch(`${API_BASE}/liste-frais-fixe`);
    if (!res.ok) throw new Error('Erreur chargement frais fixes');
    return (await res.json()).map(fromApi);
};

export const saveFraisFixe = async (row, isNew) => {
    const path = isNew ? '/ajout-frais-fixe' : '/modification-frais-fixe';
    const json = await post(path, toApi(row));
    return fromApi(json);
};

export const deleteFraisFixe = async (row) => {
    await post('/suppression-frais-fixe', { id: row.id });
};

export const toggleArchiveFraisFixe = async (id, archive) => {
    await post('/archiver-frais-fixe', { id, archive });
};

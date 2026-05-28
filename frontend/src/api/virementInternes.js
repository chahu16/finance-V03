import { API_BASE, formatDate, post } from './client.js';

const fromApi = (doc) => ({
    id: doc.id,
    compteSource: doc.compteSource,
    compteDestination: doc.compteDestination,
    montant: doc.montant,
    dateVirement: doc.dateVirement ? new Date(doc.dateVirement) : null,
});

const toApi = (row) => ({
    id: row.id,
    compteSource: row.compteSource,
    compteDestination: row.compteDestination,
    montant: row.montant,
    dateVirement: formatDate(row.dateVirement),
});

export const fetchVirementInternes = async () => {
    const res = await fetch(`${API_BASE}/liste-virements-internes`);
    if (!res.ok) throw new Error('Erreur chargement virements internes');
    return (await res.json()).map(fromApi);
};

export const saveVirementInterne = async (row, isNew) => {
    const path = isNew ? '/ajout-virement-interne' : '/modification-virement-interne';
    const json = await post(path, toApi(row));
    return fromApi(json);
};

export const deleteVirementInterne = async (row) => {
    await post('/suppression-virement-interne', { id: row.id });
};

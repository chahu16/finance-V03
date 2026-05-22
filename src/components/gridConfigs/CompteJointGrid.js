import { formatEuro } from '../config/Config.js';

export const initialSort = [
    { field: 'dateDepensesRecettes', sort: 'desc' },
];

export const snackbarMessages = {
    success: 'Transaction enregistrée',
    cancel: 'Édition annulée',
};

// Règle métier identique aux dépenses/recettes : cocher "Chèque en cours" vide la date
export const onFieldChange = ({ field, value, editingId, setEditCellValue }) => {
    if (field === 'chequeEnCours' && value === true) {
        setEditCellValue({ id: editingId, field: 'dateDepensesRecettes', value: null });
    }
    if (field === 'dateDepensesRecettes' && value != null) {
        setEditCellValue({ id: editingId, field: 'chequeEnCours', value: false });
    }
};

const formatPourcentage = (value) => {
    if (value == null || value === '') return '';
    return `${Math.round(Number(value))} %`;
};

// Colonnes de base — les headerName des colonnes % sont remplacés dynamiquement dans App.js
// selon les noms des personnes configurés dans le Paramétrage.
export const CompteJointColumns = [
    {
        field: 'dateDepensesRecettes',
        headerName: 'Date',
        type: 'date',
        width: 160,
        editable: true,
        align: 'center',
        isInitialFocus: true,
        sortComparator: (v1, v2, p1, p2) => {
            const d1 = v1 ? new Date(v1).getTime() : Infinity;
            const d2 = v2 ? new Date(v2).getTime() : Infinity;
            if (d1 !== d2) return d1 - d2;
            const desc1 = (p1.api.getRow(p1.id)?.description ?? '').toLowerCase();
            const desc2 = (p2.api.getRow(p2.id)?.description ?? '').toLowerCase();
            const cmp = desc1.localeCompare(desc2, 'fr');
            const dir = p1.api.getSortModel()[0]?.sort ?? 'asc';
            return dir === 'desc' ? -cmp : cmp;
        },
    },
    {
        field: 'description',
        headerName: 'Description',
        width: 250,
        editable: true,
    },
    {
        field: 'depenses',
        headerName: 'Dépenses',
        type: 'number',
        width: 120,
        editable: true,
        align: 'center',
        valueFormatter: formatEuro,
    },
    {
        field: 'recettes',
        headerName: 'Recettes',
        type: 'number',
        width: 120,
        editable: true,
        align: 'center',
        valueFormatter: formatEuro,
    },
    {
        field: 'fraisFixe',
        headerName: 'Frais fixe',
        type: 'boolean',
        width: 100,
        editable: true,
        align: 'center',
    },
    {
        field: 'chequeEnCours',
        headerName: 'Chèque en cours',
        type: 'boolean',
        width: 130,
        editable: true,
        align: 'center',
    },
    {
        field: 'depenseRecettesAMasquer',
        headerName: 'À masquer',
        type: 'boolean',
        width: 100,
        editable: true,
        align: 'center',
    },
    {
        field: 'pourcentageMoi',
        headerName: 'Part moi (%)',   // remplacé dynamiquement
        type: 'number',
        width: 130,
        editable: true,
        align: 'center',
        valueFormatter: formatPourcentage,
        csvAliases: ['parts'],
    },
    {
        field: 'pourcentageAutre',
        headerName: 'Part autre (%)', // remplacé dynamiquement
        type: 'number',
        width: 130,
        editable: false,
        align: 'center',
        valueGetter: (value, row) => (row.pourcentageMoi != null ? 100 - row.pourcentageMoi : null),
        valueFormatter: formatPourcentage,
    },
];

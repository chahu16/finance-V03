import './App.css';
import FullFeaturedCrudGrid from './components/DataGrid.jsx';

const formatEuro = (value) => {
  if (!value) return '';
  return `${Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
};

// Jeu de données de test
const initialRows = [
  {
    id: '1',
    compte: 'Crédit Agricole',
    dateDepensesRecettes: new Date('2026-05-14'),
    description: 'Courses supermarché',
    depenses: 85.50,
    recettes: 0,
    noteDeFrais: false,
    notesFraisRemboursee: false,
    fraisFixe: false,
    chequeEnCours: false,
    depenseRecettesAMasquer: false,
  },
  {
    id: '2',
    compte: 'Axa Banque',
    dateDepensesRecettes: new Date('2026-05-12'),
    description: 'Paye',
    depenses: 0,
    recettes: 4298.32,
    noteDeFrais: false,
    notesFraisRemboursee: false,
    fraisFixe: false,
    chequeEnCours: false,
    depenseRecettesAMasquer: false,
  },
  {
    id: '3',
    compte: 'Crédit Agricole',
    dateDepensesRecettes: null,
    description: 'Assurance voiture',
    depenses: 120.00,
    recettes: 0,
    noteDeFrais: false,
    notesFraisRemboursee: false,
    fraisFixe: true,
    chequeEnCours: false,
    depenseRecettesAMasquer: false,
  },
  {
    id: '4',
    compte: 'Axa Banque',
    dateDepensesRecettes: new Date('2026-05-10'),
    description: '2 nuits hôtel - travail',
    depenses: 240.00,
    recettes: 0,
    noteDeFrais: true,
    notesFraisRemboursee: false,
    fraisFixe: false,
    chequeEnCours: false,
    depenseRecettesAMasquer: false,
  },
  {
    id: '5',
    compte: 'Crédit Agricole',
    dateDepensesRecettes: new Date('2026-05-08'),
    description: 'Loyer',
    depenses: 648.00,
    recettes: 0,
    noteDeFrais: false,
    notesFraisRemboursee: false,
    fraisFixe: true,
    chequeEnCours: false,
    depenseRecettesAMasquer: false,
  },
];

const listeComptes = ['Crédit Agricole', 'Axa Banque'];

// Définition des colonnes
const columns = [
  {
    field: 'compte',
    headerName: 'Compte',
    width: 150,
    editable: true,
    type: 'singleSelect',
    valueOptions: listeComptes,
    isInitialFocus: true,
  },
  {
    field: 'dateDepensesRecettes',
    headerName: 'Date',
    type: 'date',
    width: 160,
    editable: true,
    align: 'center',
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
    field: 'noteDeFrais',
    headerName: 'Note de frais',
    type: 'boolean',
    width: 120,
    editable: true,
    align: 'center',
  },
  {
    field: 'notesFraisRemboursee',
    headerName: 'Remboursée',
    type: 'boolean',
    width: 120,
    editable: true,
    align: 'center',
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
];

function App() {
  return (
    <div style={{ padding: '24px' }}>
      <h2>Dépenses / Recettes</h2>
      <FullFeaturedCrudGrid
        columns={columns}
        initialRows={initialRows}
        addButtonLabel="Ajouter une dépense - recette"
        fieldFocusEdit="description"
      />
    </div>
  );
}

export default App;
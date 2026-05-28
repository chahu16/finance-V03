import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { randomId } from '@mui/x-data-grid-generator';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import './App.css';
import FullFeaturedCrudGrid from './components/DataGrid.jsx';
import StatCard from './components/StatCard.jsx';
import StatCardJoint from './components/StatCardJoint.jsx';
import { validateRow } from './components/utils/DepensesRecettesValidation.js';
import { validateRow as validateCompteRow } from './components/utils/ComptesValidation.js';
import { validateRow as validateCompteJointRow } from './components/utils/CompteJointValidation.js';
import { validateRow as validateVirementRow } from './components/utils/VirementInternesValidation.js';
import { validateRow as validateFraisFixeBaseRow } from './components/utils/FraisFixesValidation.js';
import { computeFraisFixeTrigger } from './components/utils/FraisFixesTrigger.js';
import { DepensesRecettesColumns, snackbarMessages, initialSort, onFieldChange } from './components/gridConfigs/DepensesRecettesGrid.js';
import { fetchDepensesRecettes, saveDepenseRecette, deleteDepenseRecette } from './api/depensesRecettes.js';
import { ComptesColumns, snackbarMessages as comptesMessages, initialSort as comptesInitialSort, extraRowDefaults as comptesExtraRowDefaults } from './components/gridConfigs/ComptesGrid.js';
import { fetchComptes, saveCompte, deleteCompte, toggleArchiveCompte } from './api/comptes.js';
import { fetchFraisFixes, saveFraisFixe, deleteFraisFixe, toggleArchiveFraisFixe } from './api/fraisFixes.js';
import { CompteJointColumns, snackbarMessages as compteJointMessages, initialSort as compteJointInitialSort, onFieldChange as compteJointOnFieldChange } from './components/gridConfigs/CompteJointGrid.js';
import { VirementInternesColumns, snackbarMessages as virementMessages, initialSort as virementInitialSort } from './components/gridConfigs/VirementInternesGrid.js';
import { fetchVirementInternes, saveVirementInterne, deleteVirementInterne } from './api/virementInternes.js';
import { FraisFixesColumns, snackbarMessages as fraisFixesMessages, initialSort as fraisFixesInitialSort, extraRowDefaults as fraisFixesExtraRowDefaults, onFieldChange as fraisFixesOnFieldChange } from './components/gridConfigs/FraisFixesGrid.js';
import { statCardsContainerSx } from './styles/StatCardStyles.js';
import { addButtonStyle } from './styles/GridStyles.js';
import { parametrageFormSx, formSectionTitleSx, formRowSx, computedValueSx } from './styles/CompteJointStyles.js';

const PARAMETRAGE_SECTIONS = [
    'Comptes',
    'Frais fixes',
    'Virements internes',
    'Paramétrage',
];

function App() {
    const [tab, setTab] = useState(0);
    const [rows, setRows] = useState([]);
    const [comptesRows, setComptesRows] = useState([]);
    const [virementInternesRows, setVirementInternesRows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const onSaveDepenseRecette = useCallback(async (row, isNew) => {
        return saveDepenseRecette(row, isNew);
    }, []);

    const onDeleteConfirmDepenseRecette = useCallback(async (row) => {
        await deleteDepenseRecette(row);
        return 'delete';
    }, []);

    const onSaveVirementInterne = useCallback(async (row, isNew) => {
        return saveVirementInterne(row, isNew);
    }, []);

    const onDeleteConfirmVirementInterne = useCallback(async (row) => {
        await deleteVirementInterne(row);
        return 'delete';
    }, []);

    // ─── Chargement initial — toutes les collections en parallèle ────────────
    useEffect(() => {
        Promise.all([
            fetchComptes(),
            fetchDepensesRecettes(),
            fetchFraisFixes(),
            fetchVirementInternes(),
        ])
            .then(([comptes, depRec, fraisFixes, virements]) => {
                setComptesRows(comptes);
                setRows(depRec);
                setFraisFixesRows(fraisFixes);
                setVirementInternesRows(virements);
            })
            .catch((err) => console.error('Chargement initial:', err))
            .finally(() => setIsLoading(false));
    }, []);

    const onSaveCompte = useCallback(async (row, isNew) => {
        return saveCompte(row, isNew);
    }, []);

    const onDeleteConfirmCompte = useCallback(async (row) => {
        const action = await deleteCompte(row);
        return { action };
    }, []);

    const [fraisFixesRows, setFraisFixesRows] = useState([]);

    const onSaveFraisFixe = useCallback(async (row, isNew) => {
        return saveFraisFixe(row, isNew);
    }, []);

    const onDeleteConfirmFraisFixe = useCallback(async (row) => {
        await deleteFraisFixe(row);
        return 'delete';
    }, []);
    const [showArchivedComptes, setShowArchivedComptes] = useState(false);
    const [showArchivedFraisFixes, setShowArchivedFraisFixes] = useState(false);
    const [compteJointConfig, setCompteJointConfig] = useState({
        personne1: '',
        personne2: '',
        pourcentageDefaut: 50,
        pourcentageSoldeInitialMoi: null,
    });
    const [soldeInitialPctWarning, setSoldeInitialPctWarning] = useState(false);

    // Clé du jour courant — change à minuit pour relancer le contrôle des frais fixes
    const [todayKey, setTodayKey] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    });
    useEffect(() => {
        const idRef = { current: null };
        const scheduleNextMidnight = () => {
            const now = new Date();
            const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            idRef.current = setTimeout(() => {
                const d = new Date();
                setTodayKey(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
                scheduleNextMidnight();
            }, midnight - now);
        };
        scheduleNextMidnight();
        return () => clearTimeout(idRef.current);
    }, []);

    // Synchronise les lignes sans date auto-ajoutées avec l'état courant des frais fixes :
    // - hors fenêtre → supprime la ligne sans date correspondante
    // - dans la fenêtre → ajoute la ligne si absente
    useEffect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        setRows(prevRows => {
            const toAdd = [];
            const toRemoveIds = new Set();

            for (const ff of fraisFixesRows) {
                if (ff.archived) continue;

                const trigger = computeFraisFixeTrigger(ff, today);

                // Description enrichie de l'étiquette d'occurrence pour Trimestriel / Semestriel
                // ex. "Assurance habitation (2/3)" pour la 2ème occurrence sur 3 dans l'année.
                const description = ff.description +
                    (trigger?.occurrenceLabel ? ` (${trigger.occurrenceLabel})` : '');

                if (!trigger?.inTriggerWindow) {
                    // Supprime le placeholder seulement si l'occurrence du mois courant est
                    // révolue (occurrencePast). Si la fenêtre de déclenchement n'est pas encore
                    // ouverte mais que l'échéance est toujours à venir (ex. jourPrelevement
                    // vient d'être modifié), on conserve le placeholder existant.
                    if (!trigger || trigger.occurrencePast) {
                        for (const r of prevRows) {
                            if (
                                r.compte === ff.compte &&
                                r.fraisFixe === true &&
                                r.dateDepensesRecettes == null &&
                                (r.description === ff.description ||
                                 r.description.startsWith(`${ff.description} (`))
                            ) {
                                toRemoveIds.add(r.id);
                            }
                        }
                    }
                    continue;
                }

                // Dans la fenêtre : ajoute si pas encore présent
                // - sans date : un placeholder existe déjà pour cette occurrence
                // - daté dans la période ET postérieur à l'ouverture de la fenêtre :
                //   le paiement a déjà été confirmé (ne pas créer de doublon).
                //   On exige >= triggerDate pour éviter qu'un paiement enregistré avant
                //   la fenêtre (ex. avec un ancien jourPrelevement) bloque la création.
                const alreadyHandled = prevRows.some(r =>
                    !toRemoveIds.has(r.id) &&
                    r.compte === ff.compte &&
                    r.description === description &&
                    r.fraisFixe === true &&
                    (
                        r.dateDepensesRecettes == null ||
                        (
                            trigger.isDateInCurrentPeriod(r.dateDepensesRecettes) &&
                            new Date(r.dateDepensesRecettes) >= trigger.triggerDate
                        )
                    )
                );

                if (!alreadyHandled) {
                    toAdd.push({
                        id: randomId(),
                        compte: ff.compte,
                        description,
                        depenses: ff.type === 'Dépense' ? ff.montant : 0,
                        recettes: ff.type === 'Recette' ? ff.montant : 0,
                        noteDeFrais: false,
                        notesFraisRemboursee: false,
                        fraisFixe: true,
                        chequeEnCours: false,
                        depenseRecettesAMasquer: false,
                        dateDepensesRecettes: null,
                        pourcentageMoi: ff.pourcentageMoi ?? null,
                    });
                }
            }

            if (toAdd.length === 0 && toRemoveIds.size === 0) return prevRows;
            const filtered = toRemoveIds.size > 0 ? prevRows.filter(r => !toRemoveIds.has(r.id)) : prevRows;
            return toAdd.length > 0 ? [...toAdd, ...filtered] : filtered;
        });
    }, [fraisFixesRows, todayKey]);

    const prevComptesRowsRef = useRef(comptesRows);
    useEffect(() => {
        const prev = prevComptesRowsRef.current;
        const renames = [];
        prev.forEach(oldC => {
            const newC = comptesRows.find(c => c.id === oldC.id);
            if (newC && newC.nomCompte !== oldC.nomCompte) {
                renames.push({ oldName: oldC.nomCompte, newName: newC.nomCompte });
            }
        });
        prevComptesRowsRef.current = comptesRows;
        if (renames.length === 0) return;
        setRows(prev => prev.map(r => {
            const rename = renames.find(rn => rn.oldName === r.compte);
            return rename ? { ...r, compte: rename.newName } : r;
        }));
        setFraisFixesRows(prev => prev.map(r => {
            const rename = renames.find(rn => rn.oldName === r.compte);
            return rename ? { ...r, compte: rename.newName } : r;
        }));
        setVirementInternesRows(prev => prev.map(v => {
            let updated = { ...v };
            for (const { oldName, newName } of renames) {
                if (updated.compteSource === oldName) updated = { ...updated, compteSource: newName };
                if (updated.compteDestination === oldName) updated = { ...updated, compteDestination: newName };
            }
            return updated;
        }));
    }, [comptesRows]);

    const validateCompteRowWithUniqueness = useCallback((row) => {
        const errors = validateCompteRow(row);
        const isDuplicate = comptesRows.some(r => r.id !== row.id && r.nomCompte === row.nomCompte);
        if (isDuplicate) {
            errors.nomCompte = 'Ce nom de compte existe déjà';
        }
        return errors;
    }, [comptesRows]);

    const resolveCompteDelete = useCallback((compte) => {
        const hasLinkedRows = rows.some(r => r.compte === compte.nomCompte);
        if (hasLinkedRows) {
            return {
                action: 'archive',
                dialogText: <><strong>{compte.nomCompte}</strong> possède des dépenses / recettes associées et sera archivé plutôt que supprimé.</>,
                message: `${compte.nomCompte} archivé (dépenses / recettes associées conservées)`,
            };
        }
        return { action: 'delete' };
    }, [rows]);

    const comptesExtraActions = useMemo(() => showArchivedComptes
        ? [{
            icon: <UnarchiveIcon />,
            label: 'Désarchiver',
            onClick: async (id, setRows, showSnackbar) => {
                const targetRow = comptesRows.find(r => r.id === id);
                if (targetRow?.compteJoint) {
                    const hasActiveJoint = comptesRows.some(r => r.compteJoint && !r.archived && r.id !== id);
                    if (hasActiveJoint) {
                        showSnackbar(
                            'Impossible : un compte joint est déjà actif. Archivez-le d\'abord.',
                            'error'
                        );
                        return;
                    }
                }
                try {
                    await toggleArchiveCompte(id, false);
                    setRows(prev => prev.map(r => r.id === id ? { ...r, archived: false } : r));
                    showSnackbar('Compte désarchivé', 'success');
                } catch (err) {
                    showSnackbar(err.message || 'Erreur désarchivage', 'error');
                }
            },
        }]
        : [{
            icon: <ArchiveIcon />,
            label: 'Archiver',
            onClick: async (id, setRows, showSnackbar) => {
                try {
                    await toggleArchiveCompte(id, true);
                    setRows(prev => prev.map(r => r.id === id ? { ...r, archived: true } : r));
                    showSnackbar('Compte archivé', 'info');
                } catch (err) {
                    showSnackbar(err.message || 'Erreur archivage', 'error');
                }
            },
        }],
    [showArchivedComptes, comptesRows]);

    // Noms exclus du datagrid dépenses/recettes (archivés ou compte joint, par nom)
    // Partagé entre activeComptesOptions et depensesRowFilter pour garantir leur cohérence.
    const excludedComptesNames = useMemo(
        () => new Set(comptesRows.filter(c => c.archived || c.compteJoint).map(c => c.nomCompte)),
        [comptesRows]
    );

    // Noms des comptes autorisés dans le singleSelect dépenses/recettes :
    // ni archivé, ni joint, ni homonyme d'un compte joint/archivé
    const activeComptesOptions = useMemo(
        () => comptesRows
            .filter(c => !c.archived && !c.compteJoint && !excludedComptesNames.has(c.nomCompte))
            .map(c => c.nomCompte),
        [comptesRows, excludedComptesNames]
    );

    // Compte joint actif (non archivé)
    const compteJointData = useMemo(
        () => comptesRows.find(c => c.compteJoint && !c.archived) ?? null,
        [comptesRows]
    );
    const compteJointNom = compteJointData?.nomCompte ?? null;

    // Si le compte joint disparaît alors que l'onglet est actif → retour à l'onglet 0
    useEffect(() => {
        if (!compteJointNom && tab === 2) setTab(0);
    }, [compteJointNom, tab]);

    // Colonnes dépenses/recettes avec valueOptions dynamique (= comptes actifs)
    const depensesRecettesColumns = useMemo(
        () => DepensesRecettesColumns.map(col =>
            col.field === 'compte' ? { ...col, valueOptions: activeComptesOptions } : col
        ),
        [activeComptesOptions]
    );

    // Comptes actifs avec soldeInitial défini, non joints, au moins une transaction → StatCards
    const comptesActifsData = useMemo(
        () => comptesRows
            .filter(c => !c.archived && !c.compteJoint && c.soldeInitial != null && rows.some(r => r.compte === c.nomCompte))
            .sort((a, b) => a.nomCompte.localeCompare(b.nomCompte, 'fr')),
        [comptesRows, rows]
    );

    // Colonnes comptes : checkbox compteJoint désactivée visuellement si un compte joint existe déjà
    const comptesColumnsWithJointControl = useMemo(() => {
        const hasCompteJoint = comptesRows.some(c => c.compteJoint && !c.archived);
        return ComptesColumns.map(col => {
            if (col.field !== 'compteJoint') return col;
            return {
                ...col,
                isCellEditable: (params) => !hasCompteJoint || params.row.compteJoint,
                renderCell: (params) => {
                    const isDisabled = hasCompteJoint && !params.row.compteJoint;
                    return (
                        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                            <Checkbox
                                checked={!!params.value}
                                disabled={isDisabled}
                                size="small"
                                tabIndex={-1}
                            />
                        </Box>
                    );
                },
            };
        });
    }, [comptesRows]);

    // Colonnes compte joint avec noms des personnes injectés dynamiquement
    const compteJointColumns = useMemo(() => {
        const p1 = compteJointConfig.personne1 || 'Moi';
        const p2 = compteJointConfig.personne2 || 'Autre';
        return CompteJointColumns.map(col => {
            if (col.field === 'pourcentageMoi')  return { ...col, headerName: `Part ${p1} (%)` };
            if (col.field === 'pourcentageAutre') return { ...col, headerName: `Part ${p2} (%)` };
            return col;
        });
    }, [compteJointConfig.personne1, compteJointConfig.personne2]);

    // Valeurs par défaut pour les nouvelles lignes du compte joint
    const compteJointExtraRowDefaults = useMemo(() => ({
        compte: compteJointNom ?? '',
        pourcentageMoi: Math.min(100, Math.max(0, compteJointConfig.pourcentageDefaut || 0)),
    }), [compteJointNom, compteJointConfig.pourcentageDefaut]);

    // Tous les comptes non-archivés (virements internes + frais fixes partagent la même liste)
    const allNonArchivedComptesOptions = useMemo(
        () => comptesRows.filter(c => !c.archived).map(c => c.nomCompte),
        [comptesRows]
    );

    // Colonnes virements internes avec valueOptions dynamique
    const virementInternesColumns = useMemo(
        () => VirementInternesColumns.map(col =>
            (col.field === 'compteSource' || col.field === 'compteDestination')
                ? { ...col, valueOptions: allNonArchivedComptesOptions }
                : col
        ),
        [allNonArchivedComptesOptions]
    );

    // Colonnes frais fixes : valueOptions compte + renderCell pour Mon %
    // isCellEditable retiré : params.row reflète l'état persisté (toujours '' pour une nouvelle
    // ligne), ce qui empêchait l'édition du % même après sélection du compte joint.
    const fraisFixesColumns = useMemo(() => {
        return FraisFixesColumns.map(col => {
            if (col.field === 'compte') {
                return { ...col, valueOptions: allNonArchivedComptesOptions };
            }
            if (col.field === 'pourcentageMoi') {
                return {
                    ...col,
                    renderCell: (params) => {
                        if (params.row.compte !== compteJointNom) return null;
                        if (params.value == null) return '';
                        return `${params.value} %`;
                    },
                };
            }
            return col;
        });
    }, [allNonArchivedComptesOptions, compteJointNom]);

    // onFieldChange enrichi : pré-remplit / efface pourcentageMoi selon le compte sélectionné
    const fraisFixesOnFieldChangeEnriched = useCallback((args) => {
        fraisFixesOnFieldChange(args);
        if (args.field === 'compte' && compteJointNom) {
            if (args.value === compteJointNom) {
                const current = args.getEditCellValue({ id: args.editingId, field: 'pourcentageMoi' });
                if (current == null || current === 0) {
                    args.setEditCellValue({ id: args.editingId, field: 'pourcentageMoi', value: compteJointConfig.pourcentageDefaut ?? 50 });
                }
            } else {
                args.setEditCellValue({ id: args.editingId, field: 'pourcentageMoi', value: null });
            }
        }
    }, [compteJointNom, compteJointConfig.pourcentageDefaut]);

    // Validation frais fixes : base + pourcentageMoi obligatoire sur compte joint
    const validateFraisFixeRow = useCallback((row) => {
        const errors = validateFraisFixeBaseRow(row);
        if (row.compte === compteJointNom) {
            const pct = parseFloat(row.pourcentageMoi);
            if (row.pourcentageMoi === null || row.pourcentageMoi === undefined || row.pourcentageMoi === '') {
                errors.pourcentageMoi = 'Le pourcentage est obligatoire pour un compte joint';
            } else if (isNaN(pct) || pct < 0 || pct > 100) {
                errors.pourcentageMoi = 'Le pourcentage doit être entre 0 et 100';
            }
        }
        return errors;
    }, [compteJointNom]);

    // Actions archive / désarchive pour frais fixes
    const fraisFixesExtraActions = useMemo(() => showArchivedFraisFixes
        ? [{
            icon: <UnarchiveIcon />,
            label: 'Désarchiver',
            onClick: async (id, setRows, showSnackbar) => {
                try {
                    await toggleArchiveFraisFixe(id, false);
                    setRows(prev => prev.map(r => r.id === id ? { ...r, archived: false } : r));
                    showSnackbar('Frais fixe désarchivé', 'success');
                } catch (err) {
                    showSnackbar(err.message || 'Erreur désarchivage', 'error');
                }
            },
        }]
        : [{
            icon: <ArchiveIcon />,
            label: 'Archiver',
            onClick: async (id, setRows, showSnackbar) => {
                try {
                    await toggleArchiveFraisFixe(id, true);
                    setRows(prev => prev.map(r => r.id === id ? { ...r, archived: true } : r));
                    showSnackbar('Frais fixe archivé', 'info');
                } catch (err) {
                    showSnackbar(err.message || 'Erreur archivage', 'error');
                }
            },
        }],
    [showArchivedFraisFixes]);

    // Rows pré-filtrées par compte pour éviter les filter() inline dans le JSX
    // (chaque filter() crée une nouvelle référence → re-render inutile des StatCards)
    const rowsByCompte = useMemo(() => {
        const map = {};
        rows.forEach(r => {
            if (!map[r.compte]) map[r.compte] = [];
            map[r.compte].push(r);
        });
        return map;
    }, [rows]);

    // Filtre appliqué au DataGrid dépenses : masque les lignes liées à un compte archivé ou compte joint
    const depensesRowFilter = useMemo(
        () => excludedComptesNames.size > 0 ? (row) => !excludedComptesNames.has(row.compte) : null,
        [excludedComptesNames]
    );

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>

            {/* ─── StatCards (toujours visibles) ────────────────────────────── */}
            <Box sx={{ p: 3, pb: 0 }}>
                <Box sx={statCardsContainerSx}>
                    {comptesActifsData.map(compteData => (
                        <StatCard
                            key={compteData.nomCompte}
                            compte={compteData.nomCompte}
                            rows={rowsByCompte[compteData.nomCompte] ?? []}
                            compteData={compteData}
                            virementInternesRows={virementInternesRows}
                        />
                    ))}
                    {compteJointData && compteJointData.soldeInitial != null && (
                        <StatCardJoint
                            compte={compteJointData.nomCompte}
                            rows={rowsByCompte[compteJointData.nomCompte] ?? []}
                            compteData={compteJointData}
                            compteJointConfig={compteJointConfig}
                            virementInternesRows={virementInternesRows}
                        />
                    )}
                </Box>
            </Box>

            {/* ─── Barre d'onglets ──────────────────────────────────────────── */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label="Tableau de bord" />
                    <Tab label="Dépenses / Recettes" />
                    <Tab label="Compte joint" sx={{ display: compteJointNom ? 'inline-flex' : 'none' }} />
                    <Tab label="Paramétrage" />
                </Tabs>
            </Box>

            {/* ─── Tableau de bord ──────────────────────────────────────────── */}
            {tab === 0 && (
                <Box sx={{ p: 3 }} />
            )}

            {/* ─── Dépenses / Recettes ──────────────────────────────────────── */}
            {tab === 1 && (
                <Box sx={{ p: 3 }}>
                    <FullFeaturedCrudGrid
                        columns={depensesRecettesColumns}
                        initialRows={rows}
                        addButtonLabel="Ajouter une dépense - recette"
                        fieldFocusEdit="description"
                        validateRow={validateRow}
                        messages={snackbarMessages}
                        initialSort={initialSort}
                        onFieldChange={onFieldChange}
                        onRowsChange={setRows}
                        onSave={onSaveDepenseRecette}
                        onDeleteConfirm={onDeleteConfirmDepenseRecette}
                        rowFilter={depensesRowFilter}
                    />
                </Box>
            )}

            {/* ─── Compte joint ─────────────────────────────────────────────── */}
            {tab === 2 && (
                <Box sx={{ p: 3 }}>
                    {!compteJointNom ? (
                        <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                            Aucun compte joint configuré. Activez l'option « Compte joint » dans le paramétrage des comptes.
                        </Typography>
                    ) : (
                        <FullFeaturedCrudGrid
                            columns={compteJointColumns}
                            initialRows={rows}
                            addButtonLabel="Ajouter une dépense - recette"
                            fieldFocusEdit="description"
                            validateRow={validateCompteJointRow}
                            messages={compteJointMessages}
                            initialSort={compteJointInitialSort}
                            onFieldChange={compteJointOnFieldChange}
                            onRowsChange={setRows}
                            onSave={onSaveDepenseRecette}
                            onDeleteConfirm={onDeleteConfirmDepenseRecette}
                            rowFilter={(row) => row.compte === compteJointNom}
                            extraRowDefaults={compteJointExtraRowDefaults}
                        />
                    )}
                </Box>
            )}

            {/* ─── Paramétrage ──────────────────────────────────────────────── */}
            {tab === 3 && (
                <Box sx={{ p: 3 }}>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                    {PARAMETRAGE_SECTIONS.map((label) => (
                        <Accordion
                            key={label}
                            disableGutters
                            elevation={0}
                            square
                            onChange={(_, expanded) => {
                                if (label === 'Comptes' && expanded) setShowArchivedComptes(false);
                                if (label === 'Frais fixes' && expanded) setShowArchivedFraisFixes(false);
                            }}
                            sx={{
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                '&:last-child': { borderBottom: 'none' },
                                '&:before': { display: 'none' },
                            }}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                {label}
                            </AccordionSummary>
                            <AccordionDetails sx={(label === 'Comptes' || label === 'Frais fixes') ? { p: 0 } : undefined}>
                                {label === 'Frais fixes' && (
                                    <FullFeaturedCrudGrid
                                        columns={fraisFixesColumns}
                                        initialRows={fraisFixesRows}
                                        onRowsChange={setFraisFixesRows}
                                        addButtonLabel="Ajouter un frais fixe"
                                        fieldFocusEdit="description"
                                        validateRow={validateFraisFixeRow}
                                        messages={fraisFixesMessages}
                                        initialSort={fraisFixesInitialSort}
                                        extraRowDefaults={fraisFixesExtraRowDefaults}
                                        onFieldChange={fraisFixesOnFieldChangeEnriched}
                                        onSave={onSaveFraisFixe}
                                        onDeleteConfirm={onDeleteConfirmFraisFixe}
                                        rowDisplayField="description"
                                        extraRowActions={fraisFixesExtraActions}
                                        rowFilter={showArchivedFraisFixes ? (row) => row.archived : (row) => !row.archived}
                                        height={400}
                                        toolbarSlotEnd={
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() => setShowArchivedFraisFixes(prev => !prev)}
                                                sx={addButtonStyle}
                                            >
                                                {showArchivedFraisFixes ? 'Masquer les frais fixes archivés' : 'Afficher les frais fixes archivés'}
                                            </Button>
                                        }
                                    />
                                )}
                                {label === 'Paramétrage' && (
                                    <Box sx={parametrageFormSx}>
                                        <Typography sx={formSectionTitleSx}>Compte joint</Typography>
                                        <Box sx={formRowSx}>
                                            <TextField
                                                label="Mon nom"
                                                size="small"
                                                value={compteJointConfig.personne1}
                                                onChange={(e) => setCompteJointConfig(prev => ({ ...prev, personne1: e.target.value }))}
                                                sx={{ width: 160 }}
                                                slotProps={{ inputLabel: { shrink: true } }}
                                            />
                                            <TextField
                                                label="Autre personne"
                                                size="small"
                                                value={compteJointConfig.personne2}
                                                onChange={(e) => setCompteJointConfig(prev => ({ ...prev, personne2: e.target.value }))}
                                                sx={{ width: 160 }}
                                                slotProps={{ inputLabel: { shrink: true } }}
                                            />
                                        </Box>
                                        <Box sx={formRowSx}>
                                            <TextField
                                                label={`Part ${compteJointConfig.personne1 || 'moi'} — défaut (%)`}
                                                type="number"
                                                size="small"
                                                value={compteJointConfig.pourcentageDefaut}
                                                onChange={(e) => setCompteJointConfig(prev => ({
                                                    ...prev,
                                                    pourcentageDefaut: e.target.value === '' ? '' : +e.target.value,
                                                }))}
                                                onBlur={() => setCompteJointConfig(prev => {
                                                    const v = parseFloat(prev.pourcentageDefaut);
                                                    return { ...prev, pourcentageDefaut: isNaN(v) ? 50 : Math.min(100, Math.max(0, v)) };
                                                })}
                                                slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 }, inputLabel: { shrink: true } }}
                                                sx={{ width: 160 }}
                                            />
                                            <Box sx={computedValueSx}>
                                                {compteJointConfig.personne2 || 'Autre'} : {Math.round(100 - (parseFloat(compteJointConfig.pourcentageDefaut) || 0))} %
                                            </Box>
                                        </Box>
                                        <Box sx={formRowSx}>
                                            <TextField
                                                label={`Part ${compteJointConfig.personne1 || 'moi'} — solde initial (%)`}
                                                type="number"
                                                size="small"
                                                value={compteJointConfig.pourcentageSoldeInitialMoi ?? ''}
                                                onChange={(e) => {
                                                    const newVal = e.target.value === '' ? null : +e.target.value;
                                                    if (compteJointConfig.pourcentageSoldeInitialMoi !== null) {
                                                        setSoldeInitialPctWarning(true);
                                                    }
                                                    setCompteJointConfig(prev => ({
                                                        ...prev,
                                                        pourcentageSoldeInitialMoi: newVal,
                                                    }));
                                                }}
                                                onBlur={() => setCompteJointConfig(prev => {
                                                    if (prev.pourcentageSoldeInitialMoi === null) return prev;
                                                    const v = parseFloat(prev.pourcentageSoldeInitialMoi);
                                                    return { ...prev, pourcentageSoldeInitialMoi: isNaN(v) ? null : Math.min(100, Math.max(0, v)) };
                                                })}
                                                slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 }, inputLabel: { shrink: true } }}
                                                sx={{ width: 160 }}
                                                placeholder={`${Math.round(compteJointConfig.pourcentageDefaut || 50)} % (défaut)`}
                                            />
                                            {compteJointConfig.pourcentageSoldeInitialMoi !== null && (
                                                <Box sx={computedValueSx}>
                                                    {compteJointConfig.personne2 || 'Autre'} : {Math.round(100 - (parseFloat(compteJointConfig.pourcentageSoldeInitialMoi) || 0))} %
                                                </Box>
                                            )}
                                        </Box>
                                        {soldeInitialPctWarning && (
                                            <Alert
                                                severity="warning"
                                                onClose={() => setSoldeInitialPctWarning(false)}
                                                sx={{ fontSize: '0.8rem', py: 0.5 }}
                                            >
                                                Modifier le partage du solde initial va recalculer tous les soldes — vérifiez la cohérence avec vos données.
                                            </Alert>
                                        )}
                                    </Box>
                                )}
                                {label === 'Virements internes' && (
                                    <FullFeaturedCrudGrid
                                        columns={virementInternesColumns}
                                        initialRows={virementInternesRows}
                                        addButtonLabel="Ajouter un virement interne"
                                        fieldFocusEdit="compteSource"
                                        validateRow={validateVirementRow}
                                        messages={virementMessages}
                                        initialSort={virementInitialSort}
                                        onRowsChange={setVirementInternesRows}
                                        onSave={onSaveVirementInterne}
                                        onDeleteConfirm={onDeleteConfirmVirementInterne}
                                        rowDisplayField="compteSource"
                                        height={400}
                                    />
                                )}
                                {label === 'Comptes' && (
                                    <FullFeaturedCrudGrid
                                        columns={comptesColumnsWithJointControl}
                                        initialRows={comptesRows}
                                        onRowsChange={setComptesRows}
                                        addButtonLabel="Ajouter un compte"
                                        fieldFocusEdit="nomCompte"
                                        validateRow={validateCompteRowWithUniqueness}
                                        messages={comptesMessages}
                                        initialSort={comptesInitialSort}
                                        extraRowDefaults={comptesExtraRowDefaults}
                                        showCopy={false}
                                        rowDisplayField="nomCompte"
                                        extraRowActions={comptesExtraActions}
                                        rowFilter={showArchivedComptes ? (row) => row.archived : (row) => !row.archived}
                                        resolveDelete={resolveCompteDelete}
                                        onSave={onSaveCompte}
                                        onDeleteConfirm={onDeleteConfirmCompte}
                                        height={400}
                                        toolbarSlotEnd={
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() => setShowArchivedComptes(prev => !prev)}
                                                sx={addButtonStyle}
                                            >
                                                {showArchivedComptes ? 'Masquer les comptes archivés' : 'Afficher les comptes archivés'}
                                            </Button>
                                        }
                                    />
                                )}
                            </AccordionDetails>
                        </Accordion>
                    ))}
                    </Box>
                </Box>
            )}

        </Box>
    );
}

export default App;

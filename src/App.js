import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
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
import { DepensesRecettesColumns, initialRows, snackbarMessages, initialSort, onFieldChange } from './components/gridConfigs/DepensesRecettesGrid.js';
import { ComptesColumns, initialRows as initialComptesRows, snackbarMessages as comptesMessages, initialSort as comptesInitialSort, extraRowDefaults as comptesExtraRowDefaults } from './components/gridConfigs/ComptesGrid.js';
import { CompteJointColumns, snackbarMessages as compteJointMessages, initialSort as compteJointInitialSort, onFieldChange as compteJointOnFieldChange } from './components/gridConfigs/CompteJointGrid.js';
import { VirementInternesColumns, initialRows as initialVirementRows, snackbarMessages as virementMessages, initialSort as virementInitialSort } from './components/gridConfigs/VirementInternesGrid.js';
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
    const [rows, setRows] = useState(initialRows);
    const [comptesRows, setComptesRows] = useState(initialComptesRows);
    const [virementInternesRows, setVirementInternesRows] = useState(initialVirementRows);
    const [showArchivedComptes, setShowArchivedComptes] = useState(false);
    const [compteJointConfig, setCompteJointConfig] = useState({
        personne1: '',
        personne2: '',
        pourcentageDefaut: 50,
        pourcentageSoldeInitialMoi: null,
    });
    const [soldeInitialPctWarning, setSoldeInitialPctWarning] = useState(false);

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
            onClick: (id, setRows, showSnackbar) => {
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
                setRows(prev => prev.map(r => r.id === id ? { ...r, archived: false } : r));
                showSnackbar('Compte désarchivé', 'success');
            },
        }]
        : [{
            icon: <ArchiveIcon />,
            label: 'Archiver',
            onClick: (id, setRows, showSnackbar) => {
                setRows(prev => prev.map(r => r.id === id ? { ...r, archived: true } : r));
                showSnackbar('Compte archivé', 'success');
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

    // Tous les comptes non-archivés disponibles pour les virements internes (y compris compte joint)
    const virementComptesOptions = useMemo(
        () => comptesRows.filter(c => !c.archived).map(c => c.nomCompte),
        [comptesRows]
    );

    // Colonnes virements internes avec valueOptions dynamique
    const virementInternesColumns = useMemo(
        () => VirementInternesColumns.map(col =>
            (col.field === 'compteSource' || col.field === 'compteDestination')
                ? { ...col, valueOptions: virementComptesOptions }
                : col
        ),
        [virementComptesOptions]
    );

    // Filtre appliqué au DataGrid dépenses : masque les lignes liées à un compte archivé ou compte joint
    const depensesRowFilter = useMemo(
        () => excludedComptesNames.size > 0 ? (row) => !excludedComptesNames.has(row.compte) : null,
        [excludedComptesNames]
    );

    return (
        <Box sx={{ width: '100%' }}>

            {/* ─── StatCards (toujours visibles) ────────────────────────────── */}
            <Box sx={{ p: 3, pb: 0 }}>
                <Box sx={statCardsContainerSx}>
                    {comptesActifsData.map(compteData => (
                        <StatCard
                            key={compteData.nomCompte}
                            compte={compteData.nomCompte}
                            rows={rows.filter(r => r.compte === compteData.nomCompte)}
                            compteData={compteData}
                            virementInternesRows={virementInternesRows}
                        />
                    ))}
                    {compteJointData && compteJointData.soldeInitial != null && (
                        <StatCardJoint
                            compte={compteJointData.nomCompte}
                            rows={rows.filter(r => r.compte === compteJointData.nomCompte)}
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
                            <AccordionDetails sx={label === 'Comptes' ? { p: 0 } : undefined}>
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

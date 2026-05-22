import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { frFR } from '@mui/x-data-grid/locales';
import {
    gridStyle,
    addButtonStyle,
    importButtonStyle,
    toolbarSx,
    deleteDialogSx,
    datePickerTextFieldSx,
} from '../styles/GridStyles.js';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { fr } from 'date-fns/locale';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import SaveIcon from '@mui/icons-material/Save';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CancelIcon from '@mui/icons-material/Close';
import {
    GridToolbarContainer,
    GridRowModes,
    DataGrid,
    GridRowEditStopReasons,
    GridActionsCellItem,
    useGridApiContext,
    useGridApiRef,
} from '@mui/x-data-grid';
import { randomId } from '@mui/x-data-grid-generator';
import { getRowErrors } from './utils/GridValidation.js';
import { focusCell, buildErrorMessage, getEditValues } from './utils/DataGridHelpers.js';

// ─── DatePicker intégré dans une cellule de type date ─────────────────────────
// Gère la validation, le vide-on-Échap (premier Échap vide, second annule la ligne)
function GridEditDateCell({ id, value, field, shouldAutoFocus, onCancel }) {
    const apiRef = useGridApiContext();

    const maxLimit = new Date();
    maxLimit.setHours(23, 59, 59, 999);

    const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());
    const dateValue = value && isValidDate(new Date(value)) ? new Date(value) : null;

    const handleChange = (newValue) => {
        if (newValue === null || isValidDate(newValue)) {
            apiRef.current.setEditCellValue({ id, field, value: newValue });
        }
    };

    const handleKeyDown = (event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        event.preventDefault();

        // Remonte jusqu'au conteneur des sections spinbutton
        let container = event.target;
        while (container && !container.className?.includes?.('MuiPickersSectionList-root')) {
            container = container.parentElement;
        }
        const sections = container?.querySelectorAll('[role="spinbutton"]');
        const values = sections ? Array.from(sections).map(s => s.getAttribute('aria-valuetext')) : [];
        const estVide = values.every(v => v === 'Empty' || v === null);

        if (!estVide) {
            // Premier Échap : vide la date sans quitter l'édition
            apiRef.current.setEditCellValue({ id, field, value: null });
            sections && Array.from(sections).forEach((s, i) => {
                s.setAttribute('aria-valuetext', 'Empty');
                s.textContent = i === 0 ? 'DD' : i === 1 ? 'MM' : 'YYYY';
            });
            setTimeout(() => {
                const cell = apiRef.current.getCellElement(id, field);
                if (cell) cell.focus();
            }, 50);
        } else {
            // Second Échap (champ déjà vide) : annule l'édition de la ligne
            if (onCancel) onCancel(id);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
            <DatePicker
                value={dateValue}
                onChange={handleChange}
                maxDate={maxLimit}
                localeText={{
                    todayButtonLabel: "Aujourd'hui",
                    clearButtonLabel: "Effacer",
                    cancelButtonLabel: "Annuler",
                }}
                slotProps={{
                    actionBar: { actions: ['today', 'clear', 'cancel'] },
                    field: { onKeyDown: handleKeyDown },
                    textField: {
                        variant: 'standard',
                        fullWidth: true,
                        autoFocus: shouldAutoFocus,
                        InputProps: { disableUnderline: true },
                        sx: datePickerTextFieldSx,
                    },
                }}
            />
        </LocalizationProvider>
    );
}

// ─── Helpers CSV ──────────────────────────────────────────────────────────────
function parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCSVValue(value, type) {
    const v = (value ?? '').trim();
    if (type === 'number') return parseFloat(v.replace(',', '.')) || 0;
    if (type === 'boolean') return ['true', 'oui', '1', 'yes'].includes(v.toLowerCase());
    if (type === 'date') {
        if (!v) return null;
        // Accepte DD/MM/YYYY et DD/MM/YY (année 2 chiffres → 20xx)
        const match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (match) {
            const year = +match[3] < 100 ? +match[3] + 2000 : +match[3];
            return new Date(year, +match[2] - 1, +match[1]);
        }
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    }
    return v;
}

// ─── Barre d'outils avec bouton Ajouter ───────────────────────────────────────
function EditToolbar({ setRows, setRowModesModel, addButtonLabel, emptyRow, fieldFocusAdd, isAnyRowEditing, setShowErrors, customColumns, validateRow, showSnackbar, toolbarSlotEnd }) {
    const fileInputRef = React.useRef(null);
    const [errorDialog, setErrorDialog] = React.useState({ open: false, rows: [], imported: 0 });

    const handleClick = () => {
        if (isAnyRowEditing) return;
        setShowErrors(false);
        const id = randomId();
        setRows((oldRows) => [{ ...emptyRow, id, isNew: true }, ...oldRows]);
        setRowModesModel((oldModel) => ({
            ...oldModel,
            [id]: { mode: GridRowModes.Edit, fieldToFocus: fieldFocusAdd },
        }));
    };

    const handleImportClick = () => {
        if (isAnyRowEditing) return;
        fileInputRef.current?.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        event.target.value = '';

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).filter(l => l.trim());

            if (lines.length < 2) {
                showSnackbar('Fichier CSV vide ou sans données', 'error');
                return;
            }

            const delimiter = lines[0].includes(';') ? ';' : ',';
            const headers = parseCSVLine(lines[0], delimiter);

            const colByIndex = {};
            headers.forEach((header, idx) => {
                const h = header.toLowerCase();
                const col = customColumns.find(c =>
                    c.field === header ||
                    c.headerName?.toLowerCase() === h ||
                    (Array.isArray(c.csvAliases) && c.csvAliases.some(a => a.toLowerCase() === h))
                );
                if (col) colByIndex[idx] = col;
            });

            const newRows = [];
            const errorRows = [];

            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i], delimiter);
                const row = { ...emptyRow, id: randomId(), isNew: false };

                values.forEach((value, idx) => {
                    const col = colByIndex[idx];
                    if (col) row[col.field] = parseCSVValue(value, col.type);
                });

                const errors = getRowErrors(row, customColumns, validateRow);
                if (Object.keys(errors).length > 0) {
                    errorRows.push({
                        line: i + 1,
                        messages: Object.values(errors).filter(v => v && v !== true),
                    });
                    continue;
                }

                newRows.push(row);
            }

            const tooManyErrors = errorRows.length > 5;

            if (!tooManyErrors && newRows.length > 0) {
                setRows(prev => [...newRows, ...prev]);
            }

            if (errorRows.length > 0) {
                setErrorDialog({ open: true, rows: errorRows, imported: tooManyErrors ? 0 : newRows.length });
                if (!tooManyErrors && newRows.length > 0) {
                    showSnackbar(`${newRows.length} ligne(s) importée(s) avec succès`, 'success');
                }
            } else {
                showSnackbar(`${newRows.length} ligne(s) importée(s) avec succès`, 'success');
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const closeErrorDialog = () => setErrorDialog(d => ({ ...d, open: false }));

    return (
        <>
            {/* ─── Dialogue d'erreurs d'import ─────────────────────────────── */}
            <Dialog
                open={errorDialog.open}
                onClose={closeErrorDialog}
                transitionDuration={0}
                maxWidth="sm"
                fullWidth
                sx={deleteDialogSx}
            >
                <DialogTitle>
                    {errorDialog.rows.length > 5
                        ? `Import annulé — ${errorDialog.rows.length} erreurs détectées`
                        : errorDialog.imported > 0
                            ? `Import partiel — ${errorDialog.rows.length} ligne(s) ignorée(s)`
                            : `Aucune ligne importée — ${errorDialog.rows.length} erreur(s)`
                    }
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {errorDialog.rows.map(({ line, messages }) => (
                            <Box key={line} sx={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
                                <Box component="span" sx={{ fontWeight: 600 }}>Ligne {line} :</Box>
                                {' '}{messages.join(' • ')}
                            </Box>
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeErrorDialog} color="inherit">Fermer</Button>
                </DialogActions>
            </Dialog>

            {/* ─── Toolbar ─────────────────────────────────────────────────── */}
            <GridToolbarContainer sx={toolbarSx}>
                <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
                <Button
                    color="primary"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    disabled={isAnyRowEditing}
                    onClick={handleClick}
                    size="small"
                    sx={addButtonStyle}
                >
                    {addButtonLabel || 'Ajouter'}
                </Button>
                <Button
                    color="primary"
                    variant="outlined"
                    startIcon={<UploadFileIcon />}
                    disabled={isAnyRowEditing}
                    onClick={handleImportClick}
                    size="small"
                    sx={importButtonStyle}
                >
                    Importer CSV
                </Button>
                {toolbarSlotEnd}
            </GridToolbarContainer>
        </>
    );
}

// ─── Composant principal DataGrid générique ────────────────────────────────────
export default function FullFeaturedCrudGrid({
    columns: customColumns,
    initialRows = [],
    addButtonLabel,
    fieldFocusEdit = null,
    validateRow = null,
    messages = {},
    initialSort = [],
    rowDisplayField = 'description',
    onFieldChange = null,
    onRowsChange = null,
    height = 500,
    showCopy = true,
    extraRowActions = [],
    extraRowDefaults = {},
    rowFilter = null,
    toolbarSlotEnd = null,
    resolveDelete = null,
}) {
    const apiRef = useGridApiRef();
    const [rows, setRows] = React.useState(initialRows);
    const [rowModesModel, setRowModesModel] = React.useState({});
    const [openDeleteDialog, setOpenDeleteDialog] = React.useState(false);
    const [rowToDelete, setRowToDelete] = React.useState(null);
    const [deleteResolution, setDeleteResolution] = React.useState(null);
    const [showErrors, setShowErrors] = React.useState(false);
    const [snackbar, setSnackbar] = React.useState({ open: false, message: '', severity: 'success' });

    const msgSuccess = messages.success ?? 'Ligne enregistrée avec succès';
    const msgCancel = messages.cancel ?? 'Édition annulée';

    React.useEffect(() => {
        if (onRowsChange) onRowsChange(rows);
    }, [rows, onRowsChange]);

    // ─── Refs ─────────────────────────────────────────────────────────────────
    const isDeleteDialogOpenRef = React.useRef(false);
    const lastBooleanValuesRef = React.useRef({});  // Dernières valeurs des booléens pour détecter les changements
    const justSavedNewRowIdRef = React.useRef(null);

    // ─── Snackbar ─────────────────────────────────────────────────────────────
    const showSnackbar = React.useCallback((message, severity) => {
        setSnackbar({ open: true, message, severity });
    }, []);

    const handleCloseSnackbar = (_, reason) => {
        if (reason === 'clickaway') return;
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

    // ─── Dérivés ──────────────────────────────────────────────────────────────
    const isAnyRowEditing = Object.values(rowModesModel).some(row => row.mode === GridRowModes.Edit);

    // Ligne vide construite depuis la définition des colonnes + champs extra (non-colonnes)
    const emptyRow = React.useMemo(() => {
        const obj = {};
        customColumns.forEach((col) => {
            if (col.type === 'number') obj[col.field] = 0;
            else if (col.type === 'boolean') obj[col.field] = false;
            else obj[col.field] = '';
        });
        return { ...obj, ...extraRowDefaults };
    }, [customColumns, extraRowDefaults]);

    // Premier champ à focuser lors d'un ajout (marqué isInitialFocus ou premier de la liste)
    const fieldFocusAdd = React.useMemo(
        () => customColumns.find((col) => col.isInitialFocus)?.field || customColumns[0]?.field,
        [customColumns]
    );

    // ─── Effet : changements de booléens/dates → règles inter-champs + re-render erreurs ──
    // MUI v8 ne re-render pas automatiquement la ligne quand une checkbox change,
    // donc on s'abonne au store pour forcer la mise à jour et appeler onFieldChange.
    React.useEffect(() => {
        if (!apiRef.current) return;
        const booleanFields = customColumns.filter(col => col.type === 'boolean').map(col => col.field);
        const dateFields = customColumns.filter(col => col.type === 'date').map(col => col.field);

        const unsubscribe = apiRef.current.store.subscribe(() => {
            const editRows = apiRef.current.state.editRows;
            const editingId = Object.keys(editRows)[0];
            if (!editingId) return;

            let anyChanged = false;
            for (const field of booleanFields) {
                const value = editRows[editingId]?.[field]?.value;
                if (value === undefined || value === lastBooleanValuesRef.current[field]) continue;
                lastBooleanValuesRef.current[field] = value;
                anyChanged = true;
                if (onFieldChange) {
                    // Délai 0 pour laisser MUI finaliser la mise à jour interne avant d'agir
                    onFieldChange({
                        field,
                        value,
                        editingId,
                        setEditCellValue: (args) => setTimeout(() => apiRef.current.setEditCellValue(args), 0),
                    });
                }
            }

            for (const field of dateFields) {
                const value = editRows[editingId]?.[field]?.value;
                const prevStr = String(lastBooleanValuesRef.current[field] ?? '');
                const currStr = String(value ?? '');
                if (currStr === prevStr) continue;
                lastBooleanValuesRef.current[field] = value;
                if (onFieldChange) {
                    onFieldChange({
                        field,
                        value,
                        editingId,
                        setEditCellValue: (args) => setTimeout(() => apiRef.current.setEditCellValue(args), 0),
                    });
                }
            }

            if (anyChanged && showErrors) {
                setTimeout(() => apiRef.current.updateRows([{ id: editingId }]), 0);
            }
        });
        return () => unsubscribe();
    }, [apiRef, customColumns, showErrors, onFieldChange]);

    // ─── Démarrage d'édition (factorisé pour double-clic et touche Entrée) ────
    const startEditCell = React.useCallback((id, field, type) => {
        setShowErrors(false);
        setRowModesModel((prev) => ({ ...prev, [id]: { mode: GridRowModes.Edit, fieldToFocus: field } }));
        focusCell(apiRef, id, field, type, 50);
    }, [apiRef]);

    // ─── Handlers CRUD ────────────────────────────────────────────────────────
    const handleEditClick = React.useCallback((id) => {
        const field = fieldFocusEdit || customColumns[0]?.field;
        const type = customColumns.find(c => c.field === field)?.type;
        startEditCell(id, field, type);
    }, [fieldFocusEdit, customColumns, startEditCell]);

    const handleRowEditStop = React.useCallback((params, event) => {
        if (params.reason === GridRowEditStopReasons.rowFocusOut) {
            event.defaultMuiPrevented = true;
        }
        if (params.reason === GridRowEditStopReasons.escapeKeyDown) {
            event.defaultMuiPrevented = true;
            handleCancelClick(params.id);
        }
        // handleCancelClick défini plus bas — déclaré après mais stable via useCallback
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSaveClick = (id) => {
        setRowModesModel((prev) => ({ ...prev, [id]: { mode: GridRowModes.View } }));
    };

    const handleDeleteClick = React.useCallback((id) => {
        const row = rows.find((r) => r.id === id);
        const resolution = resolveDelete ? resolveDelete(row) : { action: 'delete' };
        setRowToDelete(row);
        setDeleteResolution(resolution);
        isDeleteDialogOpenRef.current = true;
        setOpenDeleteDialog(true);
    }, [rows, resolveDelete]);

    const handleConfirmDelete = () => {
        if (rowToDelete) {
            if (deleteResolution?.action === 'archive') {
                setRows((prev) => prev.map((r) => r.id === rowToDelete.id ? { ...r, archived: true } : r));
                showSnackbar(deleteResolution.message || 'Élément archivé', 'info');
            } else {
                setRows((prev) => prev.filter((row) => row.id !== rowToDelete.id));
            }
            isDeleteDialogOpenRef.current = false;
            setOpenDeleteDialog(false);
            setRowToDelete(null);
            setDeleteResolution(null);
        }
    };

    const handleCancelDelete = () => {
        isDeleteDialogOpenRef.current = false;
        setOpenDeleteDialog(false);
        setRowToDelete(null);
        setDeleteResolution(null);
    };

    const handleCancelClick = React.useCallback((id) => {
        showSnackbar(msgCancel, 'warning');
        setShowErrors(false);
        setRows((prev) => {
            const editedRow = prev.find((row) => row.id === id);
            if (editedRow?.isNew) {
                setRowModesModel((prev) => { const next = { ...prev }; delete next[id]; return next; });
                return prev.filter((row) => row.id !== id);
            }
            setRowModesModel((prev) => ({ ...prev, [id]: { mode: GridRowModes.View, ignoreModifications: true } }));
            return prev;
        });
    }, [showSnackbar, msgCancel]);

    const handleCopyClick = React.useCallback((id) => {
        const currentValues = getEditValues(apiRef, id);
        const errors = getRowErrors(currentValues, customColumns, validateRow);

        if (Object.keys(errors).length > 0) {
            setShowErrors(true);
            showSnackbar(buildErrorMessage(customColumns, errors) || 'Validation échouée', 'error');
            return;
        }

        const dateField = customColumns.find((col) => col.type === 'date')?.field;
        const newId = randomId();
        setRows((prev) => [{ ...currentValues, id: newId, isNew: true }, ...prev]);
        setRowModesModel((prev) => ({
            ...prev,
            [id]: { mode: GridRowModes.View },
            [newId]: { mode: GridRowModes.Edit, fieldToFocus: dateField },
        }));
        focusCell(apiRef, newId, dateField, 'date', 100);
    }, [apiRef, customColumns, validateRow, showSnackbar]);

    // ─── Validation et commit d'une ligne ─────────────────────────────────────
    const processRowUpdate = (newRow, oldRow) => {
        // Ligne supprimée entre-temps (ex. annulation d'une nouvelle ligne)
        if (!rows.find((row) => row.id === newRow.id)) return oldRow;

        const errors = getRowErrors(newRow, columns, validateRow);
        if (Object.keys(errors).length > 0) {
            setShowErrors(true);
            const error = new Error(buildErrorMessage(columns, errors) || 'Validation échouée');
            error.isValidationError = true;
            throw error;
        }

        setShowErrors(false);
        const updatedRow = { ...newRow, isNew: false };
        setRows((prev) => prev.map((row) => (row.id === newRow.id ? updatedRow : row)));
        showSnackbar(msgSuccess, 'success');

        // Après re-tri, scroll et focus sur la nouvelle ligne sauvegardée
        if (newRow.isNew) {
            justSavedNewRowIdRef.current = newRow.id;
            setTimeout(() => {
                const savedId = justSavedNewRowIdRef.current;
                if (!savedId) return;
                justSavedNewRowIdRef.current = null;
                const firstField = customColumns[0]?.field;
                apiRef.current.setCellFocus(savedId, firstField);
                apiRef.current.getCellElement(savedId, firstField)?.scrollIntoView({ block: 'nearest' });
            }, 150);
        }
        return updatedRow;
    };

    // ─── Colonnes enrichies (cellClassName d'erreur + renderEditCell date) ────
    const columns = React.useMemo(() => [
        ...customColumns.map((col) => ({
            ...col,
            // Classe CSS d'erreur calculée en temps réel depuis l'état d'édition
            cellClassName: (params) => {
                if (!showErrors) return col.cellClassName || '';
                const editRowsState = apiRef.current?.state?.editRows;
                const editingRowState = editRowsState?.[params.id];
                const liveRow = { ...(apiRef.current?.getRow(params.id) || {}) };
                if (editingRowState) {
                    Object.keys(editingRowState).forEach((f) => { liveRow[f] = editingRowState[f].value; });
                }
                const errors = getRowErrors(liveRow, customColumns, validateRow);
                return errors[col.field] ? 'cell-error' : col.cellClassName || '';
            },
            // DatePicker personnalisé pour les colonnes de type date
            ...(col.type === 'date' ? {
                renderEditCell: (params) => (
                    <GridEditDateCell
                        {...params}
                        shouldAutoFocus={rowModesModel[params.id]?.fieldToFocus === col.field}
                        onCancel={handleCancelClick}
                    />
                ),
            } : {}),
        })),
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Actions',
            width: 135,
            getActions: ({ id }) => {
                const isInEditMode = rowModesModel[id]?.mode === GridRowModes.Edit;
                if (isInEditMode) {
                    return [
                        <GridActionsCellItem icon={<SaveIcon />} label="Save" onClick={() => handleSaveClick(id)} sx={{ color: 'primary.main' }} />,
                        <GridActionsCellItem icon={<CancelIcon />} label="Cancel" onClick={() => handleCancelClick(id)} color="inherit" />,
                        ...extraRowActions
                            .filter(a => a.showWhenEditing)
                            .map(a => {
                                const row = rows.find(r => r.id === id);
                                const isDisabled = a.disabled ? a.disabled(row) : false;
                                return <GridActionsCellItem key={a.label} icon={a.icon} label={a.label} onClick={() => a.onClick(id, setRows, showSnackbar)} color={a.color || 'inherit'} disabled={isDisabled} />;
                            }),
                    ];
                }
                return [
                    ...(showCopy ? [<GridActionsCellItem key="copy" icon={<ContentCopyIcon />} label="Copy" onClick={() => handleCopyClick(id)} color="inherit" />] : []),
                    <GridActionsCellItem key="edit" icon={<EditIcon />} label="Edit" onClick={() => handleEditClick(id)} color="inherit" />,
                    ...extraRowActions
                        .filter(a => !a.showWhenEditing)
                        .map(a => {
                            const row = rows.find(r => r.id === id);
                            const isDisabled = a.disabled ? a.disabled(row) : false;
                            return <GridActionsCellItem key={a.label} icon={a.icon} label={a.label} onClick={() => a.onClick(id, setRows, showSnackbar)} color={a.color || 'inherit'} disabled={isDisabled} />;
                        }),
                    <GridActionsCellItem key="delete" icon={<DeleteIcon />} label="Delete" onClick={() => handleDeleteClick(id)} color="inherit" />,
                ];
            },
        },
    ], [customColumns, rowModesModel, handleEditClick, handleDeleteClick, handleCopyClick, apiRef, showErrors, validateRow, handleCancelClick, showCopy, extraRowActions, rows, setRows, showSnackbar]);

    // ─── Gestion clavier sur les cellules ─────────────────────────────────────
    const handleCellKeyDown = React.useCallback((params, event) => {
        const isEditing = rowModesModel[params.id]?.mode === GridRowModes.Edit;

        // Suppr (hors édition) → dialogue de suppression
        if (event.key === 'Delete' && !isEditing) {
            event.preventDefault();
            handleDeleteClick(params.id);
            return;
        }

        // Échap (en édition, hors date — les dates ont leur propre handler) → restaure ou annule
        if (event.key === 'Escape' && isEditing && params.colDef.type !== 'date') {
            event.preventDefault();
            event.stopPropagation();
            event.defaultMuiPrevented = true;

            const originalRow = apiRef.current.getRow(params.id);
            const currentRow = apiRef.current.getRowWithUpdatedValues(params.id, params.field);
            const currentValue = currentRow[params.field];
            const originalValue = originalRow[params.field];
            const isEmpty = currentValue === null || currentValue === undefined
                || String(currentValue).trim() === '' || currentValue === 0;

            if (originalRow.isNew) {
                // Nouvelle ligne : vide le champ, ou annule si déjà vide
                if (!isEmpty) {
                    apiRef.current.setEditCellValue({ id: params.id, field: params.field, value: params.colDef.type === 'number' ? 0 : '' });
                } else {
                    handleCancelClick(params.id);
                }
            } else {
                // Ligne existante : restaure la valeur originale, ou annule si inchangée
                if (currentValue !== originalValue) {
                    apiRef.current.setEditCellValue({ id: params.id, field: params.field, value: originalValue });
                    focusCell(apiRef, params.id, params.field, null, 20);
                } else {
                    handleCancelClick(params.id);
                }
            }
            return;
        }

        // Entrée sur booléen → toggle
        if (event.key === 'Enter' && isEditing && params.colDef.type === 'boolean') {
            event.preventDefault();
            event.stopPropagation();
            event.defaultMuiPrevented = true;
            const row = apiRef.current.getRowWithUpdatedValues(params.id, params.field);
            apiRef.current.setEditCellValue({ id: params.id, field: params.field, value: !row[params.field] });
            return;
        }

        // Entrée hors édition → démarre l'édition sur la cellule cliquée
        if (event.key === 'Enter' && !isEditing) {
            event.preventDefault();
            event.stopPropagation();
            startEditCell(params.id, params.field, params.colDef.type);
            return;
        }

        // Entrée en édition → sauvegarde
        if (event.key === 'Enter' && isEditing) {
            event.preventDefault();
            event.stopPropagation();
            handleSaveClick(params.id);
            return;
        }

        // Tab en édition → navigation cyclique entre champs puis boutons d'action
        if (event.key === 'Tab' && isEditing) {
            const columnFields = columns.map((c) => c.field).filter((f) => f !== 'actions');
            const firstField = columnFields[0];

            if (params.field !== 'actions' && !event.shiftKey) {
                const nextField = columnFields[columnFields.indexOf(params.field) + 1] || 'actions';
                event.preventDefault();
                event.stopPropagation();
                apiRef.current.setCellFocus(params.id, nextField);
                setTimeout(() => {
                    const nextCell = apiRef.current.getCellElement(params.id, nextField);
                    const input = nextCell?.querySelector('input');
                    if (input) { input.focus(); input.select(); }
                }, 20);
                return;
            }

            if (params.field === 'actions' && !event.shiftKey) {
                const actionCell = apiRef.current.getCellElement(params.id, 'actions');
                const buttons = actionCell ? Array.from(actionCell.querySelectorAll('button')) : [];
                const currentIdx = buttons.indexOf(event.target);
                const nextButton = buttons[currentIdx + 1];

                event.preventDefault();
                event.stopPropagation();
                if (nextButton) {
                    nextButton.focus();
                } else {
                    // Dernier bouton → retour au premier champ
                    apiRef.current.setCellFocus(params.id, firstField);
                }
            }
        }
    }, [apiRef, rowModesModel, columns, handleDeleteClick, handleCancelClick, startEditCell]);

    // ─── Rendu ────────────────────────────────────────────────────────────────
    return (
        <Box sx={{ height, width: '100%' }}>
            {/* Dialogue de confirmation de suppression / archivage */}
            <Dialog
                open={openDeleteDialog}
                onClose={handleCancelDelete}
                transitionDuration={0}
                sx={deleteDialogSx}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); handleConfirmDelete(); }
                    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); handleCancelDelete(); }
                }}
            >
                <DialogTitle>
                    {deleteResolution?.action === 'archive' ? "Confirmer l'archivage" : 'Confirmer la suppression'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {deleteResolution?.action === 'archive'
                            ? (deleteResolution.dialogText ?? <>
                                <strong>{rowToDelete?.[rowDisplayField]}</strong> sera archivé et non supprimé.
                              </>)
                            : <>Voulez-vous vraiment supprimer <strong>{rowToDelete?.[rowDisplayField]}</strong> ?</>
                        }
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDelete} color="inherit">Annuler</Button>
                    <Button
                        onClick={handleConfirmDelete}
                        color={deleteResolution?.action === 'archive' ? 'warning' : 'error'}
                        variant="contained"
                    >
                        {deleteResolution?.action === 'archive' ? 'Archiver' : 'Supprimer'}
                    </Button>
                </DialogActions>
            </Dialog>

            <DataGrid
                localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                apiRef={apiRef}
                rows={rowFilter ? rows.filter(r => r.isNew || rowFilter(r)) : rows}
                columns={columns}
                editMode="row"
                density="compact"
                sx={gridStyle}
                initialState={{ sorting: { sortModel: initialSort } }}
                rowModesModel={rowModesModel}
                onRowModesModelChange={setRowModesModel}
                onRowEditStop={handleRowEditStop}
                onRowEditStart={(params, event) => {
                    if (isDeleteDialogOpenRef.current || isAnyRowEditing) {
                        event.defaultMuiPrevented = true;
                    }
                }}
                processRowUpdate={processRowUpdate}
                onProcessRowUpdateError={(error) => {
                    showSnackbar(error.message || 'Erreur de validation', 'error');
                }}
                onCellDoubleClick={(params, event) => {
                    if (!isAnyRowEditing) {
                        event.stopPropagation();
                        startEditCell(params.id, params.field, params.colDef.type);
                    }
                }}
                onCellKeyDown={handleCellKeyDown}
                showToolbar
                slots={{ toolbar: EditToolbar }}
                slotProps={{
                    toolbar: { setRows, setRowModesModel, addButtonLabel, emptyRow, fieldFocusAdd, isAnyRowEditing, setShowErrors, customColumns, validateRow, showSnackbar, toolbarSlotEnd },
                }}
            />

            {/* Snackbar de retour utilisateur : succès (vert), erreur (rouge), annulation (orange) */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { frFR } from '@mui/x-data-grid/locales';
import { gridStyle, addButtonStyle } from '../styles/GridStyles.js';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { fr } from 'date-fns/locale';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import SaveIcon from '@mui/icons-material/Save';
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
                    actionBar: { actions: ["today", "clear", "cancel"] },
                    field: {
                        onKeyDown: (event) => {
                            if (event.key === 'Escape') {
                                event.stopPropagation();
                                event.preventDefault();

                                // Récupère toutes les sections (jour, mois, année)
                                let container = event.target;
                                while (container && !container.className?.includes?.('MuiPickersSectionList-root')) {
                                    container = container.parentElement;
                                }
                                const sections = container?.querySelectorAll('[role="spinbutton"]');
                                const values = sections ? Array.from(sections).map(s => s.getAttribute('aria-valuetext')) : [];

                                // Date vide = toutes les sections sont "Empty" ou null
                                const estVide = values.every(v => v === 'Empty' || v === null);

                                if (!estVide) {
                                    // 1er Échap : vide la date visuellement et dans le state MUI
                                    apiRef.current.setEditCellValue({ id, field, value: null });
                                    // Force le vidage visuel de chaque section
                                    sections && Array.from(sections).forEach((s, i) => {
                                        s.setAttribute('aria-valuetext', 'Empty');
                                        s.textContent = i === 0 ? 'DD' : i === 1 ? 'MM' : 'YYYY';
                                    });
                                    setTimeout(() => {
                                        // Remet le focus sur la première section (JJ)
                                        const cell = apiRef.current.getCellElement(id, field);
                                        if (cell) cell.focus();
                                    }, 50);
                                } else {
                                    // 2ème Échap : annule la ligne
                                    if (onCancel) onCancel(id);
                                }
                            }
                        },
                    },
                    textField: {
                        variant: "standard",
                        fullWidth: true,
                        autoFocus: shouldAutoFocus,
                        InputProps: { disableUnderline: true },
                        sx: {
                            "& .MuiInputBase-input": {
                                textAlign: "center",
                                padding: "0px",
                            },
                        },
                    },
                }}
            />
        </LocalizationProvider>
    );
}

function EditToolbar({ setRows, setRowModesModel, addButtonLabel, emptyRow, fieldFocusAdd, isAnyRowEditing }) {
    const handleClick = () => {
        if (isAnyRowEditing) return;
        const id = randomId();
        setRows((oldRows) => [{ ...emptyRow, id, isNew: true }, ...oldRows]);
        setRowModesModel((oldModel) => ({
            ...oldModel,
            [id]: { mode: GridRowModes.Edit, fieldToFocus: fieldFocusAdd },
        }));
    };
    return (
        <GridToolbarContainer sx={{ p: 1, display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button
                color="primary"
                variant="outlined"
                startIcon={<AddIcon />}
                disabled={isAnyRowEditing}
                onClick={handleClick}
                size="small"
                sx={addButtonStyle}
            >
                {addButtonLabel || "Ajouter"}
            </Button>
        </GridToolbarContainer>
    );
}

export default function FullFeaturedCrudGrid({
    columns: customColumns,
    initialRows = [],
    addButtonLabel,
    fieldFocusEdit = null,
}) {
    const apiRef = useGridApiRef();
    const [rows, setRows] = React.useState(initialRows);
    const [rowModesModel, setRowModesModel] = React.useState({});
    const isAnyRowEditing = Object.values(rowModesModel).some(
        (row) => row.mode === GridRowModes.Edit
    );

    // Ligne vide générée depuis les colonnes
    const emptyRow = React.useMemo(() => {
        const obj = {};
        customColumns.forEach((col) => {
            if (col.type === 'number') obj[col.field] = 0;
            else if (col.type === 'boolean') obj[col.field] = false;
            else obj[col.field] = '';
        });
        return obj;
    }, [customColumns]);

    // Premier champ focusable
    const fieldFocusAdd = React.useMemo(
        () => customColumns.find((col) => col.isInitialFocus)?.field || customColumns[0]?.field,
        [customColumns]
    );

    const handleEditClick = React.useCallback((id) => {
        setRowModesModel((prev) => ({
            ...prev,
            [id]: { mode: GridRowModes.Edit, fieldToFocus: fieldFocusEdit || customColumns[0]?.field }
        }));
        setTimeout(() => {
            const cell = apiRef.current.getCellElement(id, fieldFocusEdit || customColumns[0]?.field);
            const input = cell?.querySelector('input');
            if (input) { input.focus(); input.select(); }
        }, 50);
    }, [fieldFocusEdit, customColumns, apiRef]);

    const handleRowEditStop = (params, event) => {
        if (params.reason === GridRowEditStopReasons.rowFocusOut) {
            event.defaultMuiPrevented = true;
        }
        if (params.reason === GridRowEditStopReasons.escapeKeyDown) {
            handleCancelClick(params.id);
        }
    };

    const handleSaveClick = (id) => {
        setRowModesModel((prev) => ({ ...prev, [id]: { mode: GridRowModes.View } }));
    };

    const handleDeleteClick = (id) => {
        setRows((prev) => prev.filter((row) => row.id !== id));
    };

    const handleCancelClick = (id) => {
        setRowModesModel((prev) => ({
            ...prev,
            [id]: { mode: GridRowModes.View, ignoreModifications: true },
        }));
        setRows((prev) => {
            const editedRow = prev.find((row) => row.id === id);
            if (editedRow?.isNew) return prev.filter((row) => row.id !== id);
            return prev;
        });
    };

    const processRowUpdate = (newRow) => {
        const updatedRow = { ...newRow, isNew: false };
        setRows((prev) => prev.map((row) => (row.id === newRow.id ? updatedRow : row)));
        return updatedRow;
    };

    // Ajout colonne Actions
    const columns = React.useMemo(() => [
        ...customColumns.map((col) => {
            if (col.type === 'date') {
                return {
                    ...col,
                    renderEditCell: (params) => (
                        <GridEditDateCell
                            {...params}
                            shouldAutoFocus={rowModesModel[params.id]?.fieldToFocus === col.field}
                            onCancel={handleCancelClick}
                        />
                    ),
                };
            }
            return col;
        }),
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Actions',
            width: 100,
            getActions: ({ id }) => {
                const isInEditMode = rowModesModel[id]?.mode === GridRowModes.Edit;
                if (isInEditMode) {
                    return [
                        <GridActionsCellItem icon={<SaveIcon />} label="Save" onClick={() => handleSaveClick(id)} sx={{ color: 'primary.main' }} />,
                        <GridActionsCellItem icon={<CancelIcon />} label="Cancel" onClick={() => handleCancelClick(id)} color="inherit" />,
                    ];
                }
                return [
                    <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={() => handleEditClick(id)} color="inherit" />,
                    <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={() => handleDeleteClick(id)} color="inherit" />,
                ];
            },
        },
    ], [customColumns, rowModesModel, handleEditClick]);

    return (
        <Box sx={{ height: 500, width: '100%', ...gridStyle }}>
            <DataGrid
                localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
                apiRef={apiRef}
                rows={rows}
                columns={columns}
                editMode="row"
                density="compact"
                rowModesModel={rowModesModel}
                onRowModesModelChange={setRowModesModel}
                onRowEditStop={handleRowEditStop}
                processRowUpdate={processRowUpdate}
                onCellKeyDown={(params, event) => {
                    // Entrée sur ligne en lecture → mode édition + focus
                    if (event.key === "Enter" && rowModesModel[params.id]?.mode !== GridRowModes.Edit) {
                        event.preventDefault();
                        event.stopPropagation();
                        setRowModesModel((prev) => ({
                            ...prev,
                            [params.id]: { mode: GridRowModes.Edit, fieldToFocus: fieldFocusEdit || customColumns[0]?.field },
                        }));
                        setTimeout(() => {
                            const cell = apiRef.current.getCellElement(params.id, fieldFocusEdit || customColumns[0]?.field);
                            const input = cell?.querySelector('input');
                            if (input) { input.focus(); input.select(); }
                        }, 50);
                        return;
                    }

                    // Entrée sur champ en édition → valide la ligne
                    if (event.key === "Enter" && rowModesModel[params.id]?.mode === GridRowModes.Edit) {
                        event.preventDefault();
                        event.stopPropagation();
                        handleSaveClick(params.id);
                        return;
                    }
                    if (event.key === "Tab" && rowModesModel[params.id]?.mode === GridRowModes.Edit) {
                        const columnFields = columns
                            .map((c) => c.field)
                            .filter((f) => f !== "actions");
                        const firstField = columnFields[0];

                        if (params.field !== "actions" && !event.shiftKey) {
                            const currentIndex = columnFields.indexOf(params.field);
                            const nextField = columnFields[currentIndex + 1] || "actions";

                            event.preventDefault();
                            event.stopPropagation();

                            apiRef.current.setCellFocus(params.id, nextField);

                            setTimeout(() => {
                                const nextCell = apiRef.current.getCellElement(params.id, nextField);
                                const input = nextCell?.querySelector("input");
                                if (input) {
                                    input.focus();
                                    input.select();
                                }
                            }, 20);
                            return;
                        }

                        if (params.field === "actions" && !event.shiftKey) {
                            const actionCell = apiRef.current.getCellElement(params.id, "actions");
                            const buttons = actionCell ? Array.from(actionCell.querySelectorAll("button")) : [];
                            const saveButton = buttons[0];
                            const cancelButton = buttons[1];

                            if (event.target === saveButton && cancelButton) {
                                event.preventDefault();
                                event.stopPropagation();
                                cancelButton.focus();
                                return;
                            }

                            if (event.target === cancelButton || buttons.length <= 1) {
                                event.preventDefault();
                                event.stopPropagation();
                                apiRef.current.setCellFocus(params.id, firstField);
                            }
                        }
                    }
                }}
                showToolbar
                slots={{ toolbar: EditToolbar }}
                slotProps={{
                    toolbar: { setRows, setRowModesModel, addButtonLabel, emptyRow, fieldFocusAdd, isAnyRowEditing },
                }}
            />
        </Box>
    );
}
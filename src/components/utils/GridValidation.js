/**
 * Moteur de validation des lignes (générique)
 */
export const getRowErrors = (row, columns, validateRow) => {
    const errors = {};

    if (!row || typeof row !== 'object') return errors;

    const safeColumns = Array.isArray(columns) ? columns : [];

    safeColumns.forEach((col) => {
        if (!col.field || col.field === 'actions') return;

        const value = row[col.field];
        const isEmpty = value === null || value === undefined || String(value).trim() === "";

        // 1. Champ obligatoire
        if (col.required && isEmpty) {
            errors[col.field] = col.requiredMessage || `"${col.headerName}" est obligatoire`;
        }
        // 1b. singleSelect : valeur hors options autorisées
        else if (col.type === 'singleSelect' && !isEmpty && Array.isArray(col.valueOptions) && col.valueOptions.length > 0) {
            const validOptions = col.valueOptions.map(opt => (typeof opt === 'object' ? opt.value : opt));
            if (!validOptions.includes(value)) {
                errors[col.field] = `"${col.headerName}" : valeur "${value}" non reconnue`;
            }
        }
        // 2. Validation personnalisée
        else if (typeof col.validate === 'function') {
            try {
                const validationResult = col.validate(value ?? "");
                if (validationResult !== true) {
                    errors[col.field] = typeof validationResult === 'string'
                        ? validationResult
                        : col.validateMessage || `"${col.headerName}" est invalide`;
                }
            } catch (e) {
                console.error(`Erreur validation colonne "${col.field}":`, e);
            }
        }
        // 3. Valeur minimale
        else if (col.minValue !== undefined && !isEmpty && !isNaN(value) && Number(value) < col.minValue) {
            if (!errors[col.field]) {
                errors[col.field] = col.minValueMessage || `"${col.headerName}" doit être supérieur à ${col.minValue}`;
            }
        }
    });

    // 4. Validation métier globale
    if (typeof validateRow === 'function') {
        try {
            const globalErrors = validateRow(row);
            if (globalErrors && typeof globalErrors === 'object') {
                Object.entries(globalErrors).forEach(([field, value]) => {
                    if (!errors[field] || errors[field] === true) {
                        errors[field] = value;
                    }
                });
            }
        } catch (e) {
            console.error("Erreur validateRow globale:", e);
        }
    }

    return errors;
};
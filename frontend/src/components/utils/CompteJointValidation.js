import { validateRow as validateDepenseRecette } from './DepensesRecettesValidation.js';

/**
 * Validation du compte joint : réutilise toutes les règles dépenses/recettes
 * (le compte est auto-rempli via extraRowDefaults, donc toujours valide) et
 * ajoute la règle spécifique au pourcentage de partage.
 */
export const validateRow = (row) => {
    const errors = validateDepenseRecette(row);

    // Règle 5 : Pourcentage obligatoire, entre 0 et 100
    const pct = parseFloat(row.pourcentageMoi);
    if (row.pourcentageMoi == null || row.pourcentageMoi === '') {
        errors.pourcentageMoi = 'Le pourcentage est obligatoire';
    } else if (isNaN(pct) || pct < 0 || pct > 100) {
        errors.pourcentageMoi = 'Le pourcentage doit être compris entre 0 et 100';
    }

    return errors;
};

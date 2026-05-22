/**
 * Validation métier spécifique aux virements internes
 */
export const validateRow = (row) => {
    const errors = {};
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Règle 1 : Montant obligatoire et supérieur à 0
    const montant = parseFloat(row.montant);
    if (row.montant === null || row.montant === undefined || String(row.montant).trim() === '') {
        errors.montant = 'Le montant est obligatoire';
    } else if (isNaN(montant) || montant <= 0) {
        errors.montant = 'Le montant doit être supérieur à 0';
    }

    // Règle 2 : Source et destination — présence croisée + non identiques
    const hasSource = !!row.compteSource;
    const hasDest   = !!row.compteDestination;

    if (!hasSource && !hasDest) {
        errors.compteSource      = 'Le compte source est obligatoire';
        errors.compteDestination = 'Le compte destination est obligatoire';
    } else if (hasSource && !hasDest) {
        errors.compteDestination = 'Le compte destination est obligatoire';
    } else if (!hasSource && hasDest) {
        errors.compteSource = 'Le compte source est obligatoire';
    } else if (row.compteSource === row.compteDestination) {
        errors.compteSource      = 'Le compte source et le compte destination doivent être différents';
        errors.compteDestination = true;
    }

    // Règle 3 : Date obligatoire
    if (!row.dateVirement) {
        errors.dateVirement = 'La date est obligatoire';
    }

    // Règle 4 : Pas de date dans le futur
    if (row.dateVirement && new Date(row.dateVirement) > today) {
        errors.dateVirement = 'La date ne peut pas être dans le futur';
    }

    return errors;
};

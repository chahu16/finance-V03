// Formatte une valeur en euros (ex. 1 234,56 €). Retourne '' si null/vide.
export const formatEuro = (value) => {
    if (value == null || value === '') return '';
    return `${Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
};

// Formatte un pourcentage arrondi à l'entier (ex. 50 %).
export const formatPourcent = (value) => {
    if (value == null || value === '') return '';
    return `${Math.round(Number(value))} %`;
};

// Retourne le nom du mois courant avec initiale majuscule (ex. "Mai")
export const getMonthLabel = (date = new Date()) => {
    const name = date.toLocaleString('fr-FR', { month: 'long' });
    return name.charAt(0).toUpperCase() + name.slice(1);
};

// Détermine la couleur de la carte selon le solde instant T par rapport aux seuils.
export const getCardColor = (instantT, seuil, seuilOrange) => {
    const seuilVal = seuil ?? 0;
    const orangeThreshold = seuilVal * ((seuilOrange ?? 0) / 100);
    if (instantT > seuilVal) return 'vert';
    if (instantT > orangeThreshold) return 'orange';
    return 'rouge';
};

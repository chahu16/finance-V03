const PALETTE = {
    vert:   { border: '#4caf50', icon: '#4caf50' },
    orange: { border: '#ff9800', icon: '#ff9800' },
    rouge:  { border: '#f44336', icon: '#f44336' },
};

export const cardJointSx = (color = 'vert') => ({
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    borderLeft: `4px solid ${PALETTE[color].border}`,
    padding: '14px 18px',
    minWidth: 520,
    flex: '1 1 auto',
});

export const headerJointSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    mb: 1.5,
};

export const iconJointSx = (color = 'vert') => ({
    color: PALETTE[color].icon,
    fontSize: '1.1rem',
});

export const titleJointSx = {
    fontWeight: 600,
    fontSize: '1rem',
    color: '#1a1a1a',
};

export const columnsContainerSx = {
    display: 'flex',
    gap: 0,
};

export const columnSx = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    px: 1.5,
    '&:first-of-type': { pl: 0 },
    '&:last-of-type':  { pr: 0 },
};

export const columnTitleSx = {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    mb: 0.75,
};

export const colRowSx = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 1,
    mb: 0.5,
};

export const colLabelSx = {
    fontSize: '0.8rem',
    color: '#555',
    whiteSpace: 'nowrap',
};

// Valeur du mois courant — couleur neutre
export const colValueMoisSx = {
    fontSize: '0.8rem',
    color: '#1a1a1a',
};

export const colValueTheoSx = {
    fontSize: '0.8rem',
    color: '#1a1a1a',
};

export const colDividerSx = {
    my: 1,
    borderColor: '#e0e0e0',
};

export const colInstantRowSx = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 1,
};

export const colInstantLabelSx = {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#1a1a1a',
    whiteSpace: 'nowrap',
};

// Global et MOI — couleur de la carte
export const colInstantGlobalValueSx = (color = 'vert') => ({
    fontSize: '0.875rem',
    fontWeight: 700,
    color: PALETTE[color].border,
});

// AUTRE — toujours noir
export const colInstantValueSx = {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#1a1a1a',
};

export const verticalDividerSx = {
    mx: 0.5,
    borderColor: '#e0e0e0',
};

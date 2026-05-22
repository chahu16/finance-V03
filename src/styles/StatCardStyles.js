const PALETTE = {
    vert:   { border: '#4caf50', icon: '#4caf50' },
    orange: { border: '#ff9800', icon: '#ff9800' },
    rouge:  { border: '#f44336', icon: '#f44336' },
};

export const statCardsContainerSx = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 2,
    mb: 3,
};

export const cardSx = (color = 'vert') => ({
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    borderLeft: `4px solid ${PALETTE[color].border}`,
    padding: '14px 18px',
    minWidth: 220,
    flex: '0 1 auto',
});

export const headerSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    mb: 1.5,
};

export const iconSx = (color = 'vert') => ({
    color: PALETTE[color].icon,
    fontSize: '1.1rem',
});

export const titleSx = {
    fontWeight: 600,
    fontSize: '1rem',
    color: '#1a1a1a',
};

export const rowSx = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 3,
    mb: 0.5,
};

export const labelSx = {
    fontSize: '0.875rem',
    color: '#555',
};

export const valueSx = {
    fontSize: '0.875rem',
    color: '#1a1a1a',
};

export const valueTheoSx = {
    fontSize: '0.875rem',
    color: '#1a1a1a',
};

export const dividerSx = {
    my: 1,
    borderColor: '#e0e0e0',
};

export const instantRowSx = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 3,
};

export const instantLabelSx = {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#1a1a1a',
};

export const instantValueSx = (color = 'vert') => ({
    fontSize: '0.95rem',
    fontWeight: 700,
    color: PALETTE[color].border,
});

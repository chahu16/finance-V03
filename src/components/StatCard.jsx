import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import {
    cardSx, headerSx, iconSx, titleSx,
    rowSx, labelSx, valueSx, valueTheoSx,
    dividerSx, instantRowSx, instantLabelSx, instantValueSx,
} from '../styles/StatCardStyles.js';

const fmtEuro = (value) =>
    `${Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function getCardColor(instantT, seuil, seuilOrange) {
    const seuilVal = seuil ?? 0;
    const orangeThreshold = seuilVal * ((seuilOrange ?? 0) / 100);
    if (instantT > seuilVal) return 'vert';
    if (instantT > orangeThreshold) return 'orange';
    return 'rouge';
}

function StatCard({ compte, rows, compteData, virementInternesRows = [] }) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthName = now.toLocaleString('fr-FR', { month: 'long' });
    const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const soldeInitial = compteData.soldeInitial ?? 0;
    const sommeDeCote = compteData.sommeDeCote ?? 0;
    const seuil = compteData.seuil ?? 0;
    const seuilOrange = compteData.seuilOrange ?? 0;

    const soldeMoisCourant = soldeInitial
        + rows
            .filter(r => {
                if (r.depenseRecettesAMasquer) return false;
                if (!r.dateDepensesRecettes) return false;
                const d = new Date(r.dateDepensesRecettes);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            })
            .reduce((acc, r) => acc + (r.recettes || 0) - (r.depenses || 0), 0)
        - sommeDeCote;

    // Impact net des virements internes pour ce compte
    const virementNet = virementInternesRows.reduce((acc, v) => {
        if (v.compteDestination === compte) return acc + (v.montant || 0);
        if (v.compteSource === compte) return acc - (v.montant || 0);
        return acc;
    }, 0);

    const virementNetDate = virementInternesRows
        .filter(v => v.dateVirement != null)
        .reduce((acc, v) => {
            if (v.compteDestination === compte) return acc + (v.montant || 0);
            if (v.compteSource === compte) return acc - (v.montant || 0);
            return acc;
        }, 0);

    const soldeTheorique = soldeInitial
        + rows.reduce((acc, r) => acc + (r.recettes || 0) - (r.depenses || 0), 0)
        + virementNet
        - sommeDeCote;

    const instantT = soldeInitial
        + rows
            .filter(r => r.dateDepensesRecettes != null)
            .reduce((acc, r) => acc + (r.recettes || 0) - (r.depenses || 0), 0)
        + virementNetDate
        - sommeDeCote;

    const color = getCardColor(instantT, seuil, seuilOrange);

    return (
        <Box sx={cardSx(color)}>
            <Box sx={headerSx}>
                <AccountBalanceIcon sx={iconSx(color)} />
                <Typography sx={titleSx}>{compte}</Typography>
            </Box>
            <Box sx={rowSx}>
                <Typography sx={labelSx}>Mois de {monthLabel} :</Typography>
                <Typography sx={valueSx}>{fmtEuro(soldeMoisCourant)}</Typography>
            </Box>
            <Box sx={rowSx}>
                <Typography sx={labelSx}>Solde théorique :</Typography>
                <Typography sx={valueTheoSx}>{fmtEuro(soldeTheorique)}</Typography>
            </Box>
            <Divider sx={dividerSx} />
            <Box sx={instantRowSx}>
                <Typography sx={instantLabelSx}>Instant T :</Typography>
                <Typography sx={instantValueSx(color)}>{fmtEuro(instantT)}</Typography>
            </Box>
        </Box>
    );
}

export default StatCard;

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import {
    cardJointSx, headerJointSx, iconJointSx, titleJointSx,
    columnsContainerSx, columnSx, columnTitleSx,
    colRowSx, colLabelSx, colValueMoisSx, colValueTheoSx,
    colDividerSx, colInstantRowSx, colInstantLabelSx,
    colInstantGlobalValueSx, colInstantValueSx,
    verticalDividerSx,
} from '../styles/StatCardJointStyles.js';

const fmtEuro = (value) =>
    `${Number(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function getCardColor(instantT, seuil, seuilOrange) {
    const seuilVal = seuil ?? 0;
    const orangeThreshold = seuilVal * ((seuilOrange ?? 0) / 100);
    if (instantT > seuilVal) return 'vert';
    if (instantT > orangeThreshold) return 'orange';
    return 'rouge';
}

function StatCardJoint({ compte, rows, compteData, compteJointConfig, virementInternesRows = [] }) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthName = now.toLocaleString('fr-FR', { month: 'long' });
    const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const soldeInitial  = compteData.soldeInitial  ?? 0;
    const sommeDeCote   = compteData.sommeDeCote   ?? 0;
    const seuil         = compteData.seuil         ?? 0;
    const seuilOrange   = compteData.seuilOrange   ?? 0;

    // % du solde initial pour personne1 (utilise le champ dédié, sinon le % par défaut)
    const pctSoldeInitial = (
        compteJointConfig.pourcentageSoldeInitialMoi ?? compteJointConfig.pourcentageDefaut ?? 50
    ) / 100;

    // % par transaction pour personne1
    const pctMoi = (row) =>
        ((row.pourcentageMoi ?? compteJointConfig.pourcentageDefaut ?? 50)) / 100;

    const isCurrentMonth = (date) => {
        if (!date) return false;
        const d = new Date(date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    };

    // ── Helpers pour éviter la répétition ──────────────────────────────────────
    const rowsMois = rows.filter(r => !r.depenseRecettesAMasquer && isCurrentMonth(r.dateDepensesRecettes));
    const rowsDate = rows.filter(r => r.dateDepensesRecettes != null);

    const net = (r) => (r.recettes || 0) - (r.depenses || 0);
    const sum = (list, fn) => list.reduce((acc, r) => acc + fn(r), 0);

    // ── Impact net des virements internes
    // Convention : un virement vers/depuis le compte joint est considéré 100% "moi" (p1)
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

    // ── Global ─────────────────────────────────────────────────────────────────
    const globalMois     = soldeInitial + sum(rowsMois, net) - sommeDeCote;
    const globalTheo     = soldeInitial + sum(rows,     net) + virementNet     - sommeDeCote;
    const globalInstantT = soldeInitial + sum(rowsDate, net) + virementNetDate - sommeDeCote;

    // ── Personne 1 ─────────────────────────────────────────────────────────────
    const p1Base     = soldeInitial * pctSoldeInitial - sommeDeCote * pctSoldeInitial;
    const p1Mois     = p1Base + sum(rowsMois, r => net(r) * pctMoi(r));
    const p1Theo     = p1Base + sum(rows,     r => net(r) * pctMoi(r)) + virementNet;
    const p1InstantT = p1Base + sum(rowsDate, r => net(r) * pctMoi(r)) + virementNetDate;

    // ── Personne 2 ─────────────────────────────────────────────────────────────
    const p2Base     = soldeInitial * (1 - pctSoldeInitial) - sommeDeCote * (1 - pctSoldeInitial);
    const p2Mois     = p2Base + sum(rowsMois, r => net(r) * (1 - pctMoi(r)));
    const p2Theo     = p2Base + sum(rows,     r => net(r) * (1 - pctMoi(r)));
    const p2InstantT = p2Base + sum(rowsDate, r => net(r) * (1 - pctMoi(r)));

    const color = getCardColor(globalInstantT, seuil, seuilOrange);

    const p1Label = compteJointConfig.personne1 || 'Moi';
    const p2Label = compteJointConfig.personne2 || 'Autre';

    return (
        <Box sx={cardJointSx(color)}>
            {/* ── En-tête ──────────────────────────────────────────────────── */}
            <Box sx={headerJointSx}>
                <AccountBalanceIcon sx={iconJointSx(color)} />
                <Typography sx={titleJointSx}>{compte}</Typography>
            </Box>

            {/* ── 3 colonnes ───────────────────────────────────────────────── */}
            <Box sx={columnsContainerSx}>

                {/* Global */}
                <Box sx={columnSx}>
                    <Typography sx={columnTitleSx}>Global</Typography>
                    <Box sx={colRowSx}>
                        <Typography sx={colLabelSx}>Mois de {monthLabel} :</Typography>
                        <Typography sx={colValueMoisSx}>{fmtEuro(globalMois)}</Typography>
                    </Box>
                    <Box sx={colRowSx}>
                        <Typography sx={colLabelSx}>Solde théorique :</Typography>
                        <Typography sx={colValueTheoSx}>{fmtEuro(globalTheo)}</Typography>
                    </Box>
                    <Divider sx={colDividerSx} />
                    <Box sx={colInstantRowSx}>
                        <Typography sx={colInstantLabelSx}>Instant T :</Typography>
                        <Typography sx={colInstantGlobalValueSx(color)}>{fmtEuro(globalInstantT)}</Typography>
                    </Box>
                </Box>

                <Divider orientation="vertical" flexItem sx={verticalDividerSx} />

                {/* Personne 1 */}
                <Box sx={columnSx}>
                    <Typography sx={columnTitleSx}>{p1Label}</Typography>
                    <Box sx={colRowSx}>
                        <Typography sx={colLabelSx}>Mois de {monthLabel} :</Typography>
                        <Typography sx={colValueMoisSx}>{fmtEuro(p1Mois)}</Typography>
                    </Box>
                    <Box sx={colRowSx}>
                        <Typography sx={colLabelSx}>Solde théorique :</Typography>
                        <Typography sx={colValueTheoSx}>{fmtEuro(p1Theo)}</Typography>
                    </Box>
                    <Divider sx={colDividerSx} />
                    <Box sx={colInstantRowSx}>
                        <Typography sx={colInstantLabelSx}>Instant T :</Typography>
                        <Typography sx={colInstantGlobalValueSx(color)}>{fmtEuro(p1InstantT)}</Typography>
                    </Box>
                </Box>

                <Divider orientation="vertical" flexItem sx={verticalDividerSx} />

                {/* Personne 2 */}
                <Box sx={columnSx}>
                    <Typography sx={columnTitleSx}>{p2Label}</Typography>
                    <Box sx={colRowSx}>
                        <Typography sx={colLabelSx}>Mois de {monthLabel} :</Typography>
                        <Typography sx={colValueMoisSx}>{fmtEuro(p2Mois)}</Typography>
                    </Box>
                    <Box sx={colRowSx}>
                        <Typography sx={colLabelSx}>Solde théorique :</Typography>
                        <Typography sx={colValueTheoSx}>{fmtEuro(p2Theo)}</Typography>
                    </Box>
                    <Divider sx={colDividerSx} />
                    <Box sx={colInstantRowSx}>
                        <Typography sx={colInstantLabelSx}>Instant T :</Typography>
                        <Typography sx={colInstantValueSx}>{fmtEuro(p2InstantT)}</Typography>
                    </Box>
                </Box>

            </Box>
        </Box>
    );
}

export default StatCardJoint;

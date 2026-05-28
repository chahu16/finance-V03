const { toCents } = require('../utils/utils.js');

const depensesRecettes = require('../models/depenses-recettes.js');
const compte = require('../models/compte.js');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

// --- UTILS ---

/**
 * Nettoie et formate la date à midi pour éviter les décalages TZ
 */
const formaterDateMidi = (dateSource) => {
    if (!dateSource || String(dateSource).toLowerCase() === 'null') return null;
    let dateParsed = (dateSource instanceof Date || String(dateSource).includes('T'))
        ? dayjs(dateSource)
        : dayjs(dateSource, ['DD/MM/YYYY', 'DD/MM/YY'], true);

    return dateParsed.isValid() ? dateParsed.startOf('day').add(12, 'hour').toDate() : null;
};

/**
 * Transforme un objet brut reçu du Front/CSV en objet conforme au schéma Mongoose
 */
const transformerVersSchema = (data, mappingComptes = {}) => {
    const cleanData = { ...data };
    delete cleanData.id;
    delete cleanData._id;

    return {
        ...cleanData,
        compte: mappingComptes[data.compte] || data.compteId,
        dateDepensesRecettes: formaterDateMidi(data.dateDepensesRecettes),
        depenses: toCents(data.depenses),
        recettes: toCents(data.recettes),
        noteDeFrais: parseBooleen(data.notesFrais ?? data.noteDeFrais),
        rembourser: parseBooleen(data.notesFraisRemboursee ?? data.rembourser),
        fraisFixe: parseBooleen(data.fraisFixe),
        chequeEnCours: parseBooleen(data.chequeEnCours),
        depenseRecettesAMasquer: parseBooleen(data.aMasquer ?? data.depenseRecettesAMasquer),
        parts: (() => {
            if (Array.isArray(data.parts)) return data.parts;
            const v = parseFloat(String(data.parts ?? "").replace(',', '.'));
            if (!isNaN(v)) return [v, 100 - v];
            return [50, 50];
        })(),
    };
};

/**
 * Prépare la réponse pour le DataGrid (ID et nom du compte)
 */
const formaterPourFront = (doc) => {
    const item = doc.toObject();
    return {
        ...item,
        id: typeof item._id === 'object' ? item._id.toString() : item.id,
        compte: item.compte ? item.compte.nom : "",
        fraisFixeRef: item.fraisFixeRef ? item.fraisFixeRef.toString() : null,
        depenses: (item.depenses ?? 0) / 100,
        recettes: (item.recettes ?? 0) / 100,
        parts: item.parts ?? [50, 50],
    };
};

/**
 * Préparation et validation booleen import CSV
 */
const parseBooleen = (value) => {
    const v = String(value ?? "").toLowerCase().trim();
    return ['true', '1', 'oui', 'x', 'vrai'].includes(v);
};

// Tri commun aux endpoints dépenses/recettes et compte joint :
// nulls en tête (chèques en cours), puis date décroissante, tiebreak alphabétique.
const trierParDateDesc = (a, b) => {
    const dateA = a.dateDepensesRecettes;
    const dateB = b.dateDepensesRecettes;
    if (!dateA && dateB) return -1;
    if (dateA && !dateB) return 1;
    if (new Date(dateA).getTime() === new Date(dateB).getTime()) {
        const descA = (a.description || "").trim().toLowerCase();
        const descB = (b.description || "").trim().toLowerCase();
        return descA.localeCompare(descB);
    }
    return new Date(dateB) - new Date(dateA);
};

// --- EXPORTS ---

exports.dataGridDepensesRecettes = async (req, res) => {
    try {
        const data = await depensesRecettes.find({
            virementInterne: { $ne: true },  // On exclut les virements internes
        }).populate({
            path: 'compte',
            match: { archive: { $ne: true }, estCompteJoint: { $ne: true } }
        });

        const dataFiltree = data.filter(d => d.compte !== null);

        const formattedData = dataFiltree.map(formaterPourFront).sort(trierParDateDesc);

        res.status(200).json(formattedData);
    } catch (error) {
        console.error("Erreur tri Back:", error);
        res.status(400).json({ error });
    }
};

exports.ajoutDepenseRecette = async (req, res) => {
    try {
        const compteDoc = await compte.findOne({ nom: req.body.compte });
        // Optionnel : Bloquer si le compte n'existe pas
        if (req.body.compte && !compteDoc) {
            return res.status(400).json({ message: `Le compte "${req.body.compte}" est introuvable.` });
        }

        const dataPrepared = transformerVersSchema({ ...req.body, compteId: compteDoc?._id });
        const nouvelleLigne = await new depensesRecettes(dataPrepared).save();

        // Plus rapide : on peuple directement le document sauvegardé
        await nouvelleLigne.populate('compte');

        res.status(201).json(formaterPourFront(nouvelleLigne));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.modificationDepenseRecette = async (req, res) => {
    try {
        const compteDoc = await compte.findOne({ nom: req.body.compte });
        const dataPrepared = transformerVersSchema({ ...req.body, compteId: compteDoc?._id });

        const updatedDoc = await depensesRecettes.findByIdAndUpdate(
            req.body.id,
            { $set: dataPrepared },
            { returnDocument: 'after' }
        ).populate('compte');

        res.status(200).json(formaterPourFront(updatedDoc));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.ajoutDepenseRecetteBulk = async (req, res) => {
    try {
        const lignesRecues = req.body;
        if (!Array.isArray(lignesRecues)) throw new Error("Format tableau attendu");

        const erreurs = [];
        const nomsComptesUnique = [...new Set(lignesRecues.map(l => l.compte))].filter(n => n);

        const comptesDocs = await compte.find({ nom: { $in: nomsComptesUnique } });
        const mappingComptes = {};
        comptesDocs.forEach(c => mappingComptes[c.nom] = c._id);

        const lignesValidees = [];

        lignesRecues.forEach((data, index) => {
            const numeroLigne = index + 2;
            const rowErrors = []; // On utilise ce tableau pour collecter les erreurs de la ligne

            // 1. Validation Compte
            if (!data.compte || !mappingComptes[data.compte]) {
                rowErrors.push(`Compte inconnu : "${data.compte || 'VIDE'}"`);
            }

            // 2. Validation Description
            if (!data.description || String(data.description).trim() === "") {
                rowErrors.push("Description manquante");
            }

            // 3. Validation Montants
            const d = toCents(data.depenses);
            const r = toCents(data.recettes);
            if (d === 0 && r === 0) rowErrors.push("Dépense et Recette sont à 0");
            if (d > 0 && r > 0) rowErrors.push("Une ligne ne peut pas être à la fois une dépense et une recette");

            // 4. Validation Dates & Chèque en cours (LOGIQUE FUSIONNÉE)
            const dateBrute = data.dateDepensesRecettes;
            const dateValide = formaterDateMidi(dateBrute);
            const isCheque = !!(data.chequeEnCours === '1' || data.chequeEnCours === true || data.chequeEnCours === 'true' || data.chequeEnCours === 1);

            if (isCheque) {
                // RÈGLE : Si chèque, la date DOIT être vide
                if (dateBrute && dateBrute !== "" && dateBrute !== null) {
                    rowErrors.push("Un chèque en cours ne peut pas avoir de date d'opération");
                }
            } else {
                // RÈGLE : Si pas chèque, la date DOIT être valide
                if (!dateValide) {
                    rowErrors.push("Date manquante ou invalide");
                }
            }

            const compteDoc = comptesDocs.find(c => c.nom === data.compte);

            // 5. Validation booléens
            const valeursBooleensValides = ['true', 'false', '1', '0', 'oui', 'non', 'x', 'vrai'];

            const champsAValider = compteDoc?.estCompteJoint
                ? ['fraisFixe', 'chequeEnCours', 'depenseRecettesAMasquer']
                : ['fraisFixe', 'chequeEnCours', 'depenseRecettesAMasquer', 'noteDeFrais', 'notesFraisRemboursee'];

            champsAValider.forEach(champ => {
                const v = String(data[champ] ?? "").toLowerCase().trim();
                if (!valeursBooleensValides.includes(v)) {
                    rowErrors.push(`"${champ}" invalide ou vide : "${data[champ]}" (accepté : true, false, 1, 0)`);
                }
            });

            // 6. Validation parts (compte joint uniquement — si présent)
            if (compteDoc?.estCompteJoint) {
                if (data.parts_0 === undefined || data.parts_0 === null || data.parts_0 === "") {
                    rowErrors.push(`% manquant : la colonne parts est obligatoire pour le compte joint`);
                } else {
                    const v = parseFloat(String(data.parts_0 ?? "").replace(',', '.'));
                    if (isNaN(v) || v < 0 || v > 100) {
                        rowErrors.push(`% invalide : doit être un nombre entre 0 et 100`);
                    }
                }
            }

            // 7. Finalisation de la ligne
            if (rowErrors.length > 0) {
                erreurs.push(`Ligne ${numeroLigne}: ${rowErrors.join(', ')}`);
            } else {
                lignesValidees.push(transformerVersSchema(data, mappingComptes));
            }
        });

        if (erreurs.length > 0) {
            // C'est ce retour qui déclenche la Snackbar sur le Front
            return res.status(400).json({
                message: "Erreurs de validation dans le fichier",
                details: erreurs
            });
        }

        const docsInseres = await depensesRecettes.insertMany(lignesValidees);
        const docsPeuples = await depensesRecettes.populate(docsInseres, { path: 'compte' });

        res.status(201).json(docsPeuples.map(formaterPourFront));

    } catch (err) {
        console.error("Erreur Bulk:", err);
        res.status(500).json({ message: err.message });
    }
};

exports.suppressionDepenseRecette = async (req, res, next) => {
    try {
        await depensesRecettes.deleteOne({ _id: req.body.id });
        res.status(200).json({ message: 'Objet supprimé !' });
    } catch (error) {
        res.status(400).json({ error });
    }
};

exports.dataGridCompteJoint = async (req, res) => {
    try {
        const data = await depensesRecettes.find({
            virementInterne: { $ne: true },
        }).populate({
            path: 'compte',
            match: { estCompteJoint: true }
        });

        const dataFiltree = data.filter(d => d.compte !== null);
        const formattedData = dataFiltree.map(formaterPourFront).sort(trierParDateDesc);

        res.status(200).json(formattedData);
    } catch (error) {
        res.status(400).json({ error });
    }
};

// ============================================================
// VIREMENTS INTERNES
// ============================================================

/**
 * Prépare la réponse virement pour le DataGrid
 * (populate des deux comptes source et destination)
 */
const formaterVirementPourFront = (doc) => {
    const item = doc.toObject ? doc.toObject() : doc;
    return {
        id: item._id.toString(),
        compteSource: item.compte?.nom ?? "",
        compteDestination: item.compteDestination?.nom ?? "",
        montant: item.depenses / 100,
        dateVirement: item.dateDepensesRecettes,
        virementInterne: true,
    };
};

// Liste tous les virements internes
exports.listeVirements = async (req, res) => {
    try {
        const data = await depensesRecettes
            .find({ virementInterne: true })
            .populate('compte')
            .populate('compteDestination')
            .sort({ dateDepensesRecettes: -1 });

        res.status(200).json(data.map(formaterVirementPourFront));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Création d'un virement interne
exports.ajoutVirement = async (req, res) => {
    try {
        const { compteSource, compteDestination, montant, dateVirement } = req.body;

        const compteSourceDoc = await compte.findOne({ nom: compteSource });
        const compteDestDoc = await compte.findOne({ nom: compteDestination });

        if (!compteSourceDoc) return res.status(400).json({ message: `Compte source introuvable : "${compteSource}"` });
        if (!compteDestDoc) return res.status(400).json({ message: `Compte destination introuvable : "${compteDestination}"` });
        if (compteSourceDoc._id.equals(compteDestDoc._id)) return res.status(400).json({ message: "Le compte source et le compte destination doivent être différents." });

        const doc = await new depensesRecettes({
            compte: compteSourceDoc._id,
            compteDestination: compteDestDoc._id,
            dateDepensesRecettes: formaterDateMidi(dateVirement),
            description: "Virement interne",
            depenses: toCents(montant),
            recettes: 0,
            virementInterne: true,
        }).save();

        await doc.populate('compte');
        await doc.populate('compteDestination');

        res.status(201).json(formaterVirementPourFront(doc));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Modification d'un virement interne
exports.modificationVirement = async (req, res) => {
    try {
        const { id, compteSource, compteDestination, montant, dateVirement } = req.body;

        const compteSourceDoc = await compte.findOne({ nom: compteSource });
        const compteDestDoc = await compte.findOne({ nom: compteDestination });

        if (!compteSourceDoc) return res.status(400).json({ message: `Compte source introuvable : "${compteSource}"` });
        if (!compteDestDoc) return res.status(400).json({ message: `Compte destination introuvable : "${compteDestination}"` });
        if (compteSourceDoc._id.equals(compteDestDoc._id)) return res.status(400).json({ message: "Le compte source et le compte destination doivent être différents." });

        const doc = await depensesRecettes.findByIdAndUpdate(
            id,
            {
                $set: {
                    compte: compteSourceDoc._id,
                    compteDestination: compteDestDoc._id,
                    dateDepensesRecettes: formaterDateMidi(dateVirement),
                    depenses: toCents(montant),
                }
            },
            { returnDocument: 'after' }
        ).populate('compte').populate('compteDestination');

        res.status(200).json(formaterVirementPourFront(doc));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Suppression d'un virement interne
exports.suppressionVirement = async (req, res) => {
    try {
        await depensesRecettes.deleteOne({ _id: req.body.id, virementInterne: true });
        res.status(200).json({ message: 'Virement supprimé !' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// AJOUT virement depuis CSV
exports.ajoutVirementsBulk = async (req, res) => {
    try {
        const lignesRecues = req.body;
        if (!Array.isArray(lignesRecues)) throw new Error("Format tableau attendu");

        const erreurs = [];
        const nomsComptes = [...new Set([
            ...lignesRecues.map(l => l.compteSource),
            ...lignesRecues.map(l => l.compteDestination)
        ])].filter(n => n);

        const comptesDocs = await compte.find({ nom: { $in: nomsComptes } });
        const mappingComptes = {};
        comptesDocs.forEach(c => mappingComptes[c.nom] = c._id);

        const lignesValidees = [];

        lignesRecues.forEach((data, index) => {
            const numeroLigne = index + 2;
            const rowErrors = [];

            if (!data.compteSource || !mappingComptes[data.compteSource])
                rowErrors.push(`Compte source inconnu : "${data.compteSource || 'VIDE'}"`);

            if (!data.compteDestination || !mappingComptes[data.compteDestination])
                rowErrors.push(`Compte destination inconnu : "${data.compteDestination || 'VIDE'}"`);

            if (data.compteSource && data.compteDestination && data.compteSource === data.compteDestination)
                rowErrors.push("Compte source et destination identiques");

            const montant = parseFloat(String(data.montant || "").replace(',', '.'));
            if (isNaN(montant) || montant <= 0)
                rowErrors.push("Montant invalide (doit être > 0)");

            const dateValide = formaterDateMidi(data.dateVirement);
            if (!dateValide)
                rowErrors.push("Date manquante ou invalide");

            if (rowErrors.length > 0) {
                erreurs.push(`Ligne ${numeroLigne}: ${rowErrors.join(', ')}`);
            } else {
                lignesValidees.push({
                    compte: mappingComptes[data.compteSource],
                    compteDestination: mappingComptes[data.compteDestination],
                    dateDepensesRecettes: dateValide,
                    description: "Virement interne",
                    depenses: toCents(montant),
                    recettes: 0,
                    virementInterne: true,
                });
            }
        });

        if (erreurs.length > 0) {
            return res.status(400).json({
                message: "Erreurs de validation dans le fichier",
                details: erreurs
            });
        }

        const docsInseres = await depensesRecettes.insertMany(lignesValidees);
        const docsPeuples = await depensesRecettes.populate(docsInseres, [
            { path: 'compte' },
            { path: 'compteDestination' }
        ]);

        res.status(201).json(docsPeuples.map(formaterVirementPourFront));

    } catch (err) {
        console.error("Erreur Bulk virements:", err);
        res.status(500).json({ message: err.message });
    }
};
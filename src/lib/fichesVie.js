// Les deux fiches d'intermédiation Vie de Dynassur, en données.
//
// POURQUOI CE FICHIER EXISTE
//
// L'outil Questionnaire posait quatorze questions inventées — « Quel est
// votre objectif principal ? a) Préserver mon capital b) Obtenir un revenu
// régulier c) Faire croître mon capital » — commentées « 14 questions FSMA »
// dans le code. Aucune ne figure dans les fiches réelles. Le Hub produisait
// un document qui RESSEMBLAIT à une fiche d'intermédiation sans en être une.
//
// Ce fichier porte les deux fiches telles qu'elles existent vraiment, et
// rien d'autre. Toute question ajoutée ici doit se trouver sur le papier.
//
// DEUX VERSIONS, ET LA DATE D'EFFET TRANCHE
//
// Une épargne constituée avant 2025 relève de l'ancienne fiche, après 2025
// de la nouvelle. Reconstituer un dossier de 2023 avec le formulaire de 2026
// produirait un document qui n'a jamais pu exister à cette date.
//
//   AVANT_2025 : « Analyse pour une épargne-pension et/ou une épargne à long
//                 terme par le biais d'une assurance-vie » — 4 parties.
//   APRES_2025 : « Fiche d'intermédiation Vie » — 5 parties, avec un
//                 bulletin financier bien plus détaillé.
//
// FSMA 116263A — BCE 0677519858

export const SEUIL_VERSION = '2025-01-01'

/** La version applicable à une date d'effet. Null quand la date est inconnue :
 *  on ne devine pas, on demande. */
export function versionPourDate(dateEffet) {
  if (!dateEffet) return null
  const d = dateEffet instanceof Date ? dateEffet : new Date(dateEffet)
  if (Number.isNaN(d.getTime())) return null
  return d < new Date(SEUIL_VERSION) ? 'AVANT_2025' : 'APRES_2025'
}

// Types de champs rendus par l'écran et par le PDF :
//   radio   un seul choix          opts: [texte, …]
//   check   plusieurs choix        opts: [texte, …]
//   texte   ligne libre
//   zone    bloc libre sur n lignes
//   montant nombre + €
//   table   tableau à cocher       lignes / colonnes
//   note    paragraphe d'explication, sans réponse

const EN_TETE_COMMUN = {
  fsma: '116263A',
  bce: '0677519858',
  mentionLegale:
    "Par le biais du présent document, notre bureau agit conformément à la loi du 4 avril 2014 "
    + "relative aux assurances et aux arrêtés d'exécution y afférents.",
  mentionRegistre:
    "Notre bureau est inscrit comme intermédiaire d'assurance dans la catégorie « courtier "
    + "d'assurance » dans le registre des intermédiaires d'assurance tenu par la FSMA.",
}

const COORDONNEES = {
  id: 'coordonnees',
  titre: 'Vos coordonnées',
  champs: [
    { id: 'nom', libelle: 'Nom', type: 'texte' },
    { id: 'prenom', libelle: 'Prénom', type: 'texte' },
    { id: 'adresse', libelle: 'Adresse', type: 'texte' },
    { id: 'numero_rue', libelle: 'N°', type: 'texte' },
    { id: 'code_postal', libelle: 'Code postal', type: 'texte' },
    { id: 'localite', libelle: 'Localité', type: 'texte' },
    { id: 'date_naissance', libelle: 'Date de naissance', type: 'texte' },
    { id: 'registre_national', libelle: 'N° registre national', type: 'texte' },
  ],
}

const CONSEIL_BUREAU = {
  id: 'notre_bureau',
  libelle: 'Notre bureau',
  type: 'radio',
  opts: ['fournit un conseil.', 'ne fournit pas de conseil.'],
}

// ═══════════════════════════════════════════════════════════════════════════
// AVANT 2025 — « Analyse pour une épargne-pension et/ou une épargne à long
// terme par le biais d'une assurance-vie » (8 pages)
// ═══════════════════════════════════════════════════════════════════════════

export const FICHE_AVANT_2025 = {
  cle: 'AVANT_2025',
  titre: "Analyse pour une épargne-pension et/ou une épargne à long terme par le biais d'une assurance-vie",
  titreCourt: 'Fiche Vie — avant 2025',
  ...EN_TETE_COMMUN,
  mentionCourtier:
    "En sa qualité de courtier d'assurance, notre bureau représente le client et exerce ses "
    + "activités en dehors de tout contrat d'agence exclusive.",
  coordonnees: { ...COORDONNEES, champs: [...COORDONNEES.champs, { id: 'raison_contact', libelle: 'Raison du contact', type: 'texte' }] },
  entete: [CONSEIL_BUREAU],
  parties: [
    {
      id: 'I',
      titre: 'PARTIE I. Vos exigences, besoins, objectifs, connaissances, expérience et situation financière',
      intro: "Afin de pouvoir procéder à une analyse, nous vous posons les questions suivantes. Il est "
        + "important que vous communiquiez toutes les circonstances connues de vous qui ont une importance "
        + "pour la précision de vos exigences et besoins, objectifs, connaissances, ainsi que de votre "
        + "expérience et votre situation financière.",
      sections: [
        {
          id: 'A', titre: 'A. Données professionnelles et personnelles',
          questions: [
            { id: 'a_revenus_pro', libelle: "Avez-vous des revenus professionnels (y compris des revenus en tant que conjoint aidant ou en application du quotient conjugal) ?", type: 'radio', opts: ['Oui', 'Non'] },
            { id: 'a_revenus_non_pro', libelle: 'Avez-vous des revenus non-professionnels imposables ?', type: 'radio', opts: ['Oui', 'Non'] },
            { id: 'a_credit_hypo', libelle: 'Avez-vous un crédit hypothécaire en cours ?', type: 'radio', opts: ['Oui', 'Non'] },
          ],
        },
        {
          id: 'B', titre: 'B. Objectifs',
          intro: "Vous avez exprimé le souhait d'épargner pour un complément à votre pension et vous souhaitez bénéficier d'un avantage fiscal.",
          questions: [
            { id: 'b_prestation', libelle: 'Souhaitez-vous recevoir, pour vous ou pour vos proches, une prestation complémentaire ?', type: 'radio', opts: ['Oui, pour la ou les prestations suivantes', 'Non'], precision: 'Oui, pour la ou les prestations suivantes' },
          ],
        },
        {
          id: 'C', titre: 'C. Situation financière',
          questions: [
            { id: 'c_revenus', libelle: 'Quels sont vos revenus nets mensuels (salaire, allocations, revenus locatifs, intérêts, etc.) ?', type: 'radio', opts: ['Moins de 1.500 euros', 'Entre 1.500 et 3.000 euros', 'Entre 3.000 et 5.000 euros', 'Plus de 5.000 euros'] },
            { id: 'c_epargne', libelle: "Quel montant pouvez-vous épargner chaque mois, en tenant compte de vos dépenses régulières (factures d'énergie, ménage, remboursement d'un emprunt, etc.) ?", type: 'radio', opts: ['Moins de 250 euros', 'Entre 250 et 500 euros', 'Entre 500 et 1.000 euros', 'Plus de 1.000 euros'] },
            { id: 'c_blocage', libelle: "L'argent peut-il rester bloqué jusqu'à l'âge légal de la pension et pour une durée minimum de 10 ans ?", type: 'radio', opts: ['Oui', 'Non'] },
          ],
        },
        {
          id: 'D', titre: 'D. Risque et rendement',
          questions: [
            {
              id: 'd_preference', libelle: "Quelle description convient le mieux quant à vos préférences en matière d'épargne et/ou d'investissement ?", type: 'radio',
              opts: [
                "J'attache une importance à la conservation du capital investi, même si c'est au détriment du rendement.",
                "Afin d'accroître le rendement, je suis prêt à prendre certains risques, limités toutefois, dans mes investissements (par exemple une éventuelle perte de 5% sur base annuelle). J'aspire malgré tout à des placements sûrs pour la majeure partie de mes avoirs.",
                "Rendement et risque limité sont pour moi deux critères importants. Je sais que pour obtenir davantage de rendement, je dois prendre un peu plus de risques (par exemple une éventuelle perte de 10% sur base annuelle).",
                "Je recherche un rendement aussi élevé que possible et j'accepte à cette fin de fortes variations de cours qui peuvent entraîner des pertes importantes (par exemple une éventuelle perte de 15% sur base annuelle).",
              ],
            },
            {
              id: 'd_baisse', libelle: "Si la valeur de l'assurance d'épargne-pension et/ou d'une épargne à long terme que vous envisagez devait baisser nettement plus que prévu (par exemple de moitié), pourriez-vous y faire face au moyen d'un autre revenu et/ou d'autres avoirs ?", type: 'radio',
              opts: [
                "Avec énormément de difficultés ; je peux très difficilement faire face à des déconvenues.",
                'Je dois faire face à cette déconvenue en réduisant mes dépenses.',
                "Je pourrais faire face à cette déconvenue au moyen d'autres revenus.",
                'Cela ne me pose aucun problème.',
              ],
            },
          ],
        },
        {
          id: 'E', titre: 'E. Connaissances et expérience (branche 23, combinaison branche 21/branche 23)',
          intro: "Vous avez précisé que la conservation du capital investi ne peut pas se faire au détriment du rendement "
            + "et vous êtes prêt à prendre un certain niveau de risque. Cela peut se faire via un produit dont ni le "
            + "capital ni son rendement ne sont garantis (branche 23), ou via un produit diversifiant l'épargne entre "
            + "des fonds de la branche 21 et de la branche 23 sur la base du profil de risque et de l'horizon d'investissement.",
          questions: [
            {
              id: 'e_connaissances', type: 'table',
              colonnes: ['Connaissances constatées', 'Une fois', 'Plusieurs fois', 'Volume'],
              lignes: [
                "Assurance-vie sans rendement garanti, liée à des fonds d'investissement (branche 23)",
                'Assurance-vie combinant un volet rendement garanti avec un volet sans rendement garanti (branche 21 / branche 23)',
                { titre: 'Actifs sous-jacents accessibles via une branche 23 :' },
                'Actions',
                'Obligations et autres produits à rendement fixe (ex. bons de caisse, comptes à terme…)',
                'Autres',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'II',
      titre: 'PARTIE II. Préférences en matière de durabilité',
      avertissement: "Attention : la réglementation européenne sur la durabilité est encore en plein développement. "
        + "À l'avenir, cela pourrait nécessiter des adaptations de cette fiche d'intermédiation.",
      intro: "Nous vous demandons si et dans quelle mesure vous souhaitez que votre produit d'assurance contienne un ou plusieurs des aspects durables suivants.",
      notes: [
        "Catégorie a) Les investissements sont réalisés dans des activités économiques qui contribuent à un objectif environnemental selon des critères légaux détaillés.",
        "Catégorie b) Les investissements sont réalisés dans des activités économiques qui contribuent à un objectif environnemental et/ou à un objectif social définis de manière plus générale par le législateur.",
        "Catégorie c) Les décisions d'investissement tiennent compte des principales incidences négatives qu'elles peuvent avoir sur les questions environnementales, les affaires sociales et de personnel, le respect des droits de l'homme et la lutte contre la corruption et les actes de corruption.",
      ],
      sections: [
        {
          id: 'DUR', titre: null,
          questions: [
            { id: 'dur_important', libelle: "Trouvez-vous important que votre produit d'assurance contienne un ou plusieurs aspect(s) durable(s) ?", type: 'radio', opts: ["Non, mon produit d'assurance ne doit pas nécessairement contenir des aspects durables.", "Oui, c'est important que mon produit d'assurance contienne des aspects durables."] },
            { id: 'dur_categories', libelle: 'Si oui, catégorie(s) souhaitée(s)', type: 'check', opts: ['Catégorie a', 'Catégorie b', 'Catégorie c'] },
            { id: 'dur_pct_a', libelle: 'Pourcentage minimum souhaité — Catégorie a', type: 'pourcentage' },
            { id: 'dur_pct_b', libelle: 'Pourcentage minimum souhaité — Catégorie b', type: 'pourcentage' },
            { id: 'dur_indicateurs', libelle: "Si la catégorie c est retenue, famille(s) d'indicateurs souhaitée(s)", type: 'check', opts: ['Émissions', 'Biodiversité', 'Eau', 'Déchets', 'Combustibles fossiles', 'Efficacité énergétique', 'Questions sociales et conditions de travail', "Droits de l'Homme", 'Lutte contre la corruption et les actes de corruption'] },
            { id: 'dur_autres', libelle: 'Autres préférences spécifiques', type: 'zone', lignes: 2 },
          ],
        },
      ],
    },
    {
      id: 'III',
      titre: 'PARTIE III. Conseil',
      intro: "Notre bureau fournit un conseil.\n\nSur la base de l'analyse effectuée ci-avant de vos exigences, besoins, "
        + "objectifs, connaissances, expérience et situation financière concernant l'épargne-pension et/ou l'épargne à "
        + "long terme par le biais d'une assurance-vie, nous vous proposons :",
      sections: [
        {
          id: 'PROP', titre: null,
          questions: [
            { id: 'prop_entreprise', libelle: "Entreprise d'assurance", type: 'texte' },
            { id: 'prop_produit', libelle: 'Produit', type: 'texte' },
            { id: 'prop_type', libelle: 'Type', type: 'texte', aide: 'Branche 21 / Branche 23 / combinaison' },
            { id: 'prop_prime', libelle: 'Prime / versement', type: 'texte' },
            { id: 'prop_adequation', libelle: "Déclaration d'adéquation", type: 'zone', lignes: 3 },
          ],
        },
      ],
    },
    {
      id: 'IV',
      titre: 'PARTIE IV. Information',
      intro: "Afin que vous puissiez prendre une décision en connaissance de cause, notre bureau a parcouru avec vous et vous a fourni :",
      sections: [
        {
          id: 'INFO', titre: null,
          questions: [
            {
              id: 'info_remis', type: 'check',
              opts: [
                "la fiche d'information / le document d'informations clés applicable, reprenant notamment les informations essentielles, les mises en garde sur les risques ainsi que les coûts et frais ;",
                "les conditions du contrat d'assurance choisi ;",
                "les informations précontractuelles relatives à la durabilité du produit d'assurance proposé ;",
                'la note explicative sur les préférences en matière de durabilité.',
                'Vous confirmez que nous avons parcouru la fiche client avec vous.',
              ],
            },
          ],
        },
      ],
      pied: [
        "Le travail de notre bureau en relation avec le contrat d'assurance est rémunéré sur la base d'une rémunération comprise dans la prime que vous payez.",
        'Fait en deux exemplaires, dont un est remis au client.',
      ],
      rgpd: [
        "Le traitement des données à caractère personnel est nécessaire afin de pouvoir proposer des services de distribution d'assurances. Il se fonde notamment sur l'exécution d'un contrat ou de mesures précontractuelles et sur les intérêts légitimes, conformément au RGPD. Des informations complémentaires sont disponibles dans la politique de gestion des données à caractère personnel du bureau.",
        "La satisfaction de la clientèle est une priorité pour notre bureau. Toute réclamation détaillée peut être adressée au bureau. Si le traitement de la réclamation n'apporte pas satisfaction, le client peut prendre contact avec le Service Ombudsman Assurances.",
      ],
    },
    {
      id: 'COMP',
      titre: 'Informations complémentaires - Réclamations et protection des données',
      intro: 'Service Ombudsman Assurances : Square de Meeûs 35, 1000 Bruxelles. Le service constitue l\'entité qualifiée compétente pour les assurances du Service de médiation pour le consommateur.',
      sections: [
        {
          id: 'OBS', titre: null,
          questions: [
            { id: 'obs_remarques', libelle: 'Observations complémentaires / remarques du client ou du conseiller', type: 'zone', lignes: 6 },
            { id: 'obs_documents', libelle: 'Documents complémentaires remis', type: 'check', opts: ['Fiche client', "Document d'informations clés / KID", 'Conditions générales', 'Conditions particulières / proposition', 'Informations sur les coûts et frais', 'Informations précontractuelles de durabilité', 'Autre'] },
          ],
        },
      ],
    },
  ],
}

// ═══════════════════════════════════════════════════════════════════════════
// APRÈS 2025 — « Fiche d'intermédiation Vie » (11 pages)
// ═══════════════════════════════════════════════════════════════════════════

export const FICHE_APRES_2025 = {
  cle: 'APRES_2025',
  titre: "FICHE D'INTERMÉDIATION VIE",
  sousTitre: "Analyse pour les assurances d'épargne et d'investissement",
  titreCourt: 'Fiche Vie — après 2025',
  ...EN_TETE_COMMUN,
  coordonnees: COORDONNEES,
  entete: [
    { id: 'bulletin_anterieur', libelle: 'Avez-vous déjà fait établir un bulletin financier par le biais de notre bureau ?', type: 'radio', opts: ['Oui', 'Non'] },
    { id: 'raison_contact', libelle: 'Raison du contact', type: 'texte' },
    CONSEIL_BUREAU,
  ],
  parties: [
    {
      id: 'I',
      titre: "PARTIE I. Vos exigences et besoins pour l'épargne ou l'investissement par le biais d'une assurance-vie",
      intro: "Afin de procéder à une analyse de vos exigences et besoins, nous vous posons les questions suivantes. "
        + "Il est important que vous communiquiez toutes les circonstances connues de vous qui ont une importance "
        + "pour la précision de vos exigences et besoins.",
      sections: [
        {
          id: 'EX', titre: null,
          questions: [
            {
              id: 'i_objectif', libelle: "Quel est concrètement votre objectif d'épargne et/ou d'investissement ?", type: 'check',
              opts: [
                'Chercher à constituer un montant (capital) pour une dépense spécifique dans le futur.',
                "D'une manière générale, faire fructifier un capital.",
                'Anticiper les évolutions de la bourse.',
                'Un revenu (mensuel) pour compléter mon revenu actuel.',
                'Un complément à mon revenu futur (par exemple une pension complémentaire).',
              ],
            },
            { id: 'i_prestation', libelle: 'Souhaitez-vous recevoir, pour vous ou pour vos proches, une prestation complémentaire dans l\'une des situations suivantes ?', type: 'check', opts: ['Décès', 'Invalidité', 'Décès consécutif à un accident', 'Autres', 'Non'], precision: 'Autres' },
            { id: 'i_fiscal', libelle: 'Souhaitez-vous bénéficier de la déductibilité fiscale ?', type: 'radio', opts: ['Oui', 'Non'] },
            { id: 'i_paiement', libelle: 'Comment souhaitez-vous payer votre (vos) prime(s) ?', type: 'radio', opts: ['Prime unique', 'Primes périodiques', 'Primes libres'] },
            { id: 'i_montant', libelle: 'Quel montant souhaitez-vous verser ?', type: 'montant' },
            { id: 'i_blocage', libelle: "Combien de temps l'argent peut-il rester bloqué ?", type: 'radio', opts: ['De 0 à 3 ans', 'De 4 à 8 ans', 'De 9 à 16 ans', '17 ans ou plus'] },
            { id: 'i_retraits', libelle: 'Devez-vous pouvoir entre-temps effectuer des retraits ?', type: 'check', opts: ['À mon gré', 'Périodiquement', "Sous la forme d'une rente viagère", 'Par le biais de rachats planifiés', 'Non'] },
            { id: 'i_specifiques', libelle: 'Exigences spécifiques / informations complémentaires', type: 'zone', lignes: 2 },
          ],
        },
      ],
    },
    {
      id: 'II',
      titre: 'PARTIE II. Bulletin financier - Questionnaire pour le client',
      intro: "Afin d'établir un bulletin financier, nous vous posons les questions suivantes. Il est important que vous nous communiquiez des informations exactes et actualisées.",
      sections: [
        {
          id: 'PERS', titre: null,
          questions: [
            { id: 'ii_pour_qui', libelle: 'Pour quelle(s) personne(s) ce document est-il complété ?', type: 'radio', opts: ['Uniquement pour vous-même.', 'Pour le patrimoine commun du ménage pour lequel vous déclarez être le représentant.', 'Autre (à spécifier)'], precision: 'Autre (à spécifier)' },
          ],
        },
        {
          id: 'A', titre: 'A. Connaissances et expérience',
          questions: [
            { id: 'a_formation', sousTitre: '1) Formation et connaissances', libelle: 'Avez-vous acquis dans le cadre de votre formation ou par vous-même des connaissances spécifiques dans le domaine de la finance ?', type: 'radio', opts: ['Oui, je dispose de connaissances dans le domaine de la finance.', 'Non, je ne dispose pas de connaissances dans le domaine de la finance.'] },
            { id: 'a_profession', sousTitre: '2) Profession et connaissances', libelle: 'Avez-vous, dans le cadre de votre activité professionnelle, acquis des connaissances spécifiques dans le domaine de la finance ?', type: 'radio', opts: ["Oui, j'ai acquis dans le cadre de ma profession des connaissances dans le domaine de la finance.", 'Non, je ne dispose pas de connaissances dans le domaine de la finance.'] },
            {
              id: 'a_interet', sousTitre: '3) Expérience et intérêt', libelle: 'De quelle manière vous informez-vous sur le monde économico-financier ?', type: 'radio',
              opts: [
                "Cela ne m'intéresse pas ou à peine. Je ne recherche pas moi-même des informations.",
                'Je lis régulièrement les pages financières de mon journal.',
                "Je recherche activement des informations financières. En outre, je recherche des informations supplémentaires sur Internet ou j'assiste régulièrement à des soirées d'information dans ce domaine.",
                "Je suis les marchés financiers de par mes activités professionnelles. Je travaille par exemple pour une institution financière, une société de bourse ou le département financier d'une entreprise.",
              ],
            },
            {
              id: 'a_produits', sousTitre: '4) Connaissances et expérience par produit',
              libelle: "Complétez les tableaux ci-après pour les produits connus et les investissements effectués actuellement ou au cours des cinq dernières années.",
              type: 'table',
              titreTable: "A. Connaissances et expérience relatives aux assurances d'épargne et d'investissement",
              colonnes: ['Connaissances constatées', 'Une fois', 'Plusieurs fois', "Volume de l'investissement"],
              lignes: [
                "Assurance-vie avec rendement garanti (assurance d'épargne relevant de la branche 21)",
                "Assurance-vie sans rendement garanti, liée à des fonds d'investissement (assurance d'investissement relevant de la branche 23)",
                'Assurance-vie sans rendement garanti, mais avec protection du capital investi, liée à des fonds d\'investissement (branche 23)',
                'Assurance-vie combinant un volet rendement garanti avec un volet sans rendement garanti (branche 21 / branche 23)',
                { titre: 'Actifs sous-jacents accessibles via une assurance de la branche 23' },
                'Actions',
                'Obligations et autres produits à rendement fixe (ex. bons de caisse, comptes à terme…)',
                'Autres',
                "Contrat de capitalisation avec rendement garanti (assurance d'épargne relevant de la branche 26)",
              ],
            },
            {
              id: 'a_autres_produits', type: 'table',
              titreTable: "B. Connaissances et expérience relatives à d'autres produits financiers",
              colonnes: ['Connaissances constatées', 'Une fois', 'Régulièrement', 'Volume'],
              lignesLibres: 5,
              enTeteLigne: 'Autres produits financiers connus',
            },
          ],
        },
        {
          id: 'B', titre: 'B. Situation financière',
          questions: [
            { id: 'b_mobilier', sousTitre: '1) Patrimoine : biens mobiliers', libelle: "Quelle est la valeur de votre patrimoine mobilier (liquidités, comptes à vue et d'épargne, assurance-vie, obligations, actions et autres investissements) ?", type: 'radio', opts: ['Moins de 12.500 euros', 'Entre 12.500 et 50.000 euros', 'Entre 50.000 et 125.000 euros', 'Entre 125.000 et 250.000 euros', 'Plus de 250.000 euros'] },
            { id: 'b_immobilier', sousTitre: '2) Patrimoine : biens immobiliers', libelle: 'Êtes-vous propriétaire d\'un bien immobilier (maisons, appartements, terrains à bâtir) ?', type: 'radio', opts: ['Non, je ne suis pas propriétaire d\'un bien immobilier.', 'Oui, je suis propriétaire d\'un bien immobilier pour mon propre usage (habitation familiale).', 'Oui, je suis propriétaire de plusieurs biens immobiliers qui sont ou ne sont pas pour mon propre usage.'] },
            { id: 'b_revenus', sousTitre: '3) Situation financière', libelle: 'A. Quels sont vos revenus nets mensuels (salaire, allocations, revenus locatifs, intérêts, etc.) ?', type: 'radio', opts: ['Moins de 1.500 euros', 'Entre 1.500 et 3.000 euros', 'Entre 3.000 et 5.000 euros', 'Plus de 5.000 euros'] },
            { id: 'b_charges', libelle: "B. À combien s'élèvent vos charges mensuelles régulières (remboursement d'un emprunt, loyer, factures d'énergie, ménage) ?", type: 'radio', opts: ['Moins de 750 euros', 'Entre 750 et 1.500 euros', 'Entre 1.500 et 2.500 euros', 'Plus de 2.500 euros'] },
            { id: 'b_capacite', sousTitre: "4) Capacité d'épargne", libelle: "Quel montant pouvez-vous épargner chaque mois, en tenant compte de vos dépenses régulières (factures d'énergie, ménage, remboursement d'un emprunt…) ?", type: 'radio', opts: ['Moins de 250 euros', 'Entre 250 et 500 euros', 'Entre 500 et 1.000 euros', 'Plus de 1.000 euros'] },
            { id: 'b_evolution', sousTitre: '5) Évolution prévue de la situation financière', libelle: "Disposez-vous actuellement d'indications objectives selon lesquelles votre situation financière évoluera dans un délai d'un an ?", type: 'radio', opts: ['Oui, négativement', 'Non', 'Oui, positivement'] },
          ],
        },
        {
          id: 'C', titre: "C. Objectifs d'investissement",
          questions: [
            {
              id: 'c_objectif', libelle: "1) Quel est votre principal objectif d'épargne et/ou d'investissement ?", type: 'radio',
              opts: [
                'Chercher à constituer un montant (capital) pour une dépense spécifique dans le futur.',
                "D'une manière générale, faire fructifier un capital.",
                'Anticiper les évolutions de la bourse.',
                'Un revenu (mensuel) pour compléter mon revenu actuel.',
                'Un complément à mon revenu futur (par exemple une pension complémentaire).',
              ],
            },
            { id: 'c_delai', libelle: '2) Quel est le délai de réalisation de votre objectif ?', type: 'radio', opts: ['De 0 à 3 ans', 'De 4 à 8 ans', 'De 9 à 16 ans', '17 ans ou plus'] },
          ],
        },
        {
          id: 'D', titre: 'D. Comportement face au risque',
          questions: [
            {
              id: 'd_preference', libelle: "1) Quelle description convient le mieux quant à vos préférences en matière d'épargne et/ou d'investissement ?", type: 'radio',
              opts: [
                "J'attache une importance à la conservation du capital investi, même si c'est au détriment du rendement.",
                "Afin d'accroître le rendement, je suis prêt à prendre certains risques, limités toutefois, dans mes investissements (par exemple une éventuelle perte de 5% sur base annuelle). J'aspire malgré tout à des placements sûrs pour la majeure partie de mes avoirs.",
                "Rendement et risque limité sont pour moi deux critères importants. Je sais que pour obtenir davantage de rendement, je dois prendre un peu plus de risques (par exemple une éventuelle perte de 10% sur base annuelle).",
                "Je recherche un rendement aussi élevé que possible et j'accepte à cette fin de fortes variations de cours qui peuvent entraîner des pertes importantes (par exemple une éventuelle perte de 15% sur base annuelle).",
              ],
            },
            {
              id: 'd_baisse_court', libelle: "2) Comment réagiriez-vous si la valeur de votre assurance d'épargne et/ou d'investissement devait fortement baisser à court terme (par exemple une perte de 15% sur deux mois de temps) ?", type: 'radio',
              opts: [
                "Je vois cela comme une opportunité d'effectuer d'autres achats à des conditions avantageuses.",
                'Je conserve mes investissements ou assurances, mais je suis leur évolution de près.',
                "J'envisage de me débarrasser de l'ensemble ou d'une partie de mes investissements ou assurances afin de limiter mes pertes.",
                "Je n'en dors plus et me débarrasse immédiatement de mes investissements ou assurances.",
              ],
            },
            {
              id: 'd_fluctuations', libelle: "3) Comment réagiriez-vous à des fluctuations de votre assurance d'épargne et/ou d'investissement pendant toute la durée du contrat ?", type: 'radio',
              opts: [
                "Je ne réagis pas. En effet, les fluctuations sont inhérentes aux assurances d'épargne et d'investissement.",
                "De façon modérée. C'est surtout le résultat au terme qui m'intéresse.",
                'De façon excessive. Je suivrai de près les fluctuations.',
                "De façon très excessive. Je songe à vendre mes assurances d'épargne et/ou d'investissement.",
              ],
            },
            {
              id: 'd_capacite', libelle: "4) Si la valeur de l'assurance d'épargne et/ou d'investissement que vous envisagez devait baisser nettement plus que prévu (par exemple de moitié), pourriez-vous y faire face au moyen d'un autre revenu et/ou d'autres avoirs ?", type: 'radio',
              opts: [
                "Avec énormément de difficultés ; je peux très difficilement faire face à des déconvenues.",
                'Je dois faire face à cette déconvenue en réduisant mes dépenses.',
                "Je pourrais faire face à cette déconvenue au moyen d'autres revenus.",
                'Cela ne me pose aucun problème.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'III',
      titre: 'PARTIE III. Préférences en matière de durabilité',
      avertissement: "Attention : la réglementation européenne sur la durabilité est encore en plein développement. "
        + "À l'avenir, cela pourrait nécessiter des adaptations de cette fiche d'intermédiation.",
      intro: 'Par aspects durables, on entend notamment :',
      notes: [
        "Catégorie a) investissements dans des activités économiques qui contribuent à un objectif environnemental selon des critères légaux détaillés.",
        "Catégorie b) investissements dans des activités économiques qui contribuent à un objectif environnemental et/ou à un objectif social définis de manière plus générale par le législateur.",
        "Catégorie c) prise en compte des principales incidences négatives sur les questions environnementales, sociales et de personnel, les droits de l'Homme et la lutte contre la corruption.",
      ],
      sections: [
        {
          id: 'DUR', titre: null,
          questions: [
            { id: 'dur_important', libelle: "Trouvez-vous important que votre produit d'assurance contienne un ou plusieurs aspect(s) durable(s) ?", type: 'radio', opts: ["Non, mon produit d'assurance ne doit pas nécessairement contenir des aspects durables.", "Oui, c'est important que mon produit d'assurance contienne des aspects durables."] },
            { id: 'dur_precisions', libelle: 'Si oui, précisions / préférences', type: 'zone', lignes: 3 },
          ],
        },
      ],
    },
    {
      id: 'IV',
      titre: 'PARTIE IV. Conseil',
      intro: "Notre bureau fournit un conseil.\n\nNotre bureau vous fournit un conseil et établit à cette fin un bulletin "
        + "financier de votre situation, sauf si vous avez confirmé qu'un bulletin financier établi précédemment et vos "
        + "préférences en matière de durabilité sont toujours d'actualité.",
      sections: [
        {
          id: 'BASE', titre: null,
          questions: [
            {
              id: 'iv_base', libelle: 'La proposition est établie sur la base', type: 'check',
              opts: [
                "de l'analyse de vos exigences et besoins concernant une assurance d'épargne et/ou d'investissement ;",
                'de votre bulletin financier établi sur la base de vos connaissances et de votre expérience, de votre capacité financière et de vos objectifs financiers ;',
                'des préférences en matière de durabilité que vous avez exprimées.',
              ],
            },
            { id: 'prop_entreprise', libelle: "Entreprise d'assurance", type: 'texte' },
            { id: 'prop_produit', libelle: 'Produit', type: 'texte' },
            { id: 'prop_type', libelle: 'Type', type: 'radio', opts: ['Branche 21', 'Branche 23', 'Branche 26', 'Combinaison'] },
            { id: 'prop_prime', libelle: 'Prime / versement', type: 'texte' },
            { id: 'prop_adequation', libelle: "Déclaration d'adéquation", type: 'zone', lignes: 4 },
          ],
        },
      ],
    },
    {
      id: 'V',
      titre: 'PARTIE V. Information',
      intro: "Afin que vous puissiez prendre une décision en connaissance de cause, notre bureau a parcouru avec vous et vous a fourni :",
      sections: [
        {
          id: 'INFO', titre: null,
          questions: [
            {
              id: 'info_remis', type: 'check',
              opts: [
                'votre bulletin financier (y compris vos préférences en matière de durabilité).',
                "la fiche d'information / le document d'informations clés applicable, contenant notamment les informations essentielles, orientations et mises en garde appropriées sur les risques, ainsi que les coûts et frais.",
                "les conditions du contrat d'assurance choisi.",
                "les informations précontractuelles relatives à la durabilité du produit d'assurance proposé.",
                'la note explicative sur les préférences en matière de durabilité.',
                'Vous confirmez que nous avons parcouru la fiche client avec vous.',
              ],
            },
            { id: 'info_complementaire', libelle: 'Information complémentaire remise au client', type: 'zone', lignes: 2 },
          ],
        },
      ],
      pied: [
        "Le travail de notre bureau en relation avec le contrat d'assurance est rémunéré sur la base d'une rémunération comprise dans la prime que vous payez.",
        'Fait en deux exemplaires, dont un est remis au client.',
      ],
    },
    {
      id: 'SYNTH',
      titre: 'BULLETIN FINANCIER - SYNTHÈSE',
      sections: [
        {
          id: 'S1', titre: 'Vos connaissances et votre expérience',
          questions: [
            { id: 's_connaissances', libelle: 'Connaissances générales en matière financière', type: 'zone', lignes: 2 },
            { id: 's_produits', libelle: 'Connaissance et expérience du produit', type: 'check', opts: ['Branche 21', 'Branche 23', 'Branche 23 avec protection du capital', 'Combinaison branche 21 / branche 23', 'Branche 26', 'Autres produits financiers'] },
          ],
        },
        {
          id: 'S2', titre: 'Votre situation financière',
          questions: [
            { id: 's_situation', libelle: 'Situation générale sur le plan financier', type: 'zone', lignes: 2 },
            { id: 's_evolution', libelle: 'Évolution prévue', type: 'texte' },
            { id: 's_montant', libelle: 'Montant à investir / patrimoine mobilier', type: 'texte' },
          ],
        },
        {
          id: 'S3', titre: "Vos objectifs d'épargne et d'investissement",
          questions: [
            { id: 's_objectif', libelle: 'Objectif principal', type: 'texte' },
            { id: 's_horizon', libelle: 'Horizon', type: 'texte' },
            { id: 's_exigences', libelle: 'Exigences / besoins spécifiques', type: 'texte' },
          ],
        },
        {
          id: 'S4', titre: 'Votre tolérance au risque',
          questions: [
            { id: 's_preferences', libelle: 'Préférences en matière de sécurité et de rendement', type: 'texte' },
            { id: 's_tolerance', libelle: "Tolérance au risque d'une manière générale", type: 'texte' },
          ],
        },
        {
          id: 'S5', titre: 'Vos préférences en matière de durabilité',
          questions: [
            { id: 's_durabilite', libelle: null, type: 'zone', lignes: 2 },
          ],
        },
      ],
    },
  ],
  noteDurabilite: {
    titre: 'NOTE EXPLICATIVE SUR LES PRÉFÉRENCES EN MATIÈRE DE DURABILITÉ',
    intro: "Les préférences en matière de durabilité sont demandées parce que les produits peuvent présenter des "
      + "caractéristiques différentes sur le plan de la durabilité, et ce dans des mesures variables.",
    blocs: [
      {
        titre: 'Catégorie a : objectif environnemental selon des critères détaillés',
        texte: "Cette catégorie vise un investissement durable sur le plan environnemental au sens du Règlement Taxonomie. "
          + "Elle concerne notamment des activités contribuant substantiellement à un ou plusieurs objectifs "
          + "environnementaux, sans causer de préjudice important aux autres objectifs, dans le respect de garanties "
          + "minimales et de critères d'examen techniques.",
        liste: ['atténuation du changement climatique ;', 'adaptation au changement climatique ;', 'utilisation durable et protection des ressources aquatiques et marines ;', 'transition vers une économie circulaire ;', 'prévention et contrôle de la pollution ;', 'protection et restauration de la biodiversité et des écosystèmes.'],
        apres: "À titre d'exemples, cette catégorie peut couvrir l'amélioration de l'efficacité énergétique, la réutilisation et le recyclage des déchets ou l'utilisation et la gestion durables des sols.",
      },
      {
        titre: 'Catégorie b : objectif environnemental et/ou objectif social',
        texte: "Cette catégorie vise un investissement durable au sens du Règlement SFDR : contribution à un ou plusieurs "
          + "objectifs environnementaux et/ou sociaux, absence de préjudice important à ces objectifs et application de "
          + "pratiques de bonne gouvernance par les sociétés dans lesquelles les investissements sont réalisés.",
        apres: "Les objectifs peuvent notamment concerner l'utilisation efficace des ressources, les énergies renouvelables, "
          + "les émissions de gaz à effet de serre, la biodiversité, l'économie circulaire, la lutte contre les inégalités, "
          + "la cohésion sociale, l'intégration sociale et les relations de travail.",
      },
      {
        titre: 'Catégorie c : principales incidences négatives',
        texte: "Cette catégorie concerne la prise en compte, dans la stratégie d'investissement, des principales incidences "
          + "négatives que les décisions d'investissement peuvent avoir sur les facteurs de durabilité.",
        listeTitre: 'Familles d\'indicateurs pouvant notamment être prises en compte :',
        liste: ['Les émissions', 'La biodiversité', "L'eau", 'Les déchets', 'Les combustibles fossiles', "L'efficacité énergétique", 'Les questions sociales et conditions de travail', "Les droits de l'Homme", 'La lutte contre la corruption et les actes de corruption'],
      },
      {
        titre: 'Autres préférences spécifiques',
        texte: "Le client peut mentionner des préférences qui n'ont pas été traitées dans les questions précédentes, par "
          + "exemple l'absence d'investissement dans l'énergie nucléaire ou dans le charbon.",
      },
      {
        titre: 'Pourcentage minimum',
        texte: "Un produit peut contenir des aspects durables dans des mesures variables. La mesure dans laquelle un produit "
          + "contient des aspects durables est indiquée dans les documents précontractuels au moyen d'un pourcentage. Le "
          + "client peut indiquer le pourcentage minimum souhaité pour les catégories concernées.",
        apres: "Le pourcentage d'aspects durables du produit proposé correspondant aux préférences du client peut fluctuer à l'avenir.",
      },
    ],
  },
}

export const FICHES = {
  AVANT_2025: FICHE_AVANT_2025,
  APRES_2025: FICHE_APRES_2025,
}

/** Toutes les questions d'une fiche, à plat, dans l'ordre du document. */
export function questionsAPlat(fiche) {
  const out = []
  for (const q of fiche.entete || []) out.push({ ...q, partie: null, section: null })
  for (const partie of fiche.parties || []) {
    for (const section of partie.sections || []) {
      for (const q of section.questions || []) {
        out.push({ ...q, partie: partie.id, section: section.id })
      }
    }
  }
  return out
}

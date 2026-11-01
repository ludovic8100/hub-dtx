#!/usr/bin/env python3
"""
HUB DTX — Lecture des relevés de compte producteur (RCP) des compagnies.

Remplace Qlik/BRIO comme source de la production financière : chaque compagnie
envoie un relevé mensuel, et ces relevés sont la donnée d'origine (ce que la
compagnie nous doit et nous a payé), pas une recopie.

Un parseur par compagnie, car chaque mise en page est différente. Chaque parseur
rend les lignes ET les totaux annoncés par le document, pour que l'appelant
compare les deux : un relevé dont la somme des lignes ne tombe pas sur son propre
total annoncé n'est pas importé. C'est ce contrôle qui rend l'extraction sûre —
sans lui, une ligne manquée passerait inaperçue.

Les parseurs travaillent sur du TEXTE et ne font aucune entrée/sortie : ils sont
testables sans accès SharePoint ni base de données.
"""
import re
from dataclasses import dataclass, field, asdict


@dataclass
class Ligne:
    client_nom: str | None = None
    police: str | None = None
    date_echeance: str | None = None      # ISO AAAA-MM-JJ
    code_operation: str | None = None
    libelle_operation: str | None = None
    categorie: str | None = None
    sous_agent_code: str | None = None
    debit: float | None = None
    credit: float | None = None
    ligne_brute: str | None = None


@dataclass
class Releve:
    compagnie: str
    compte_producteur: str | None = None
    periode: str | None = None            # ISO AAAA-MM-01
    lignes: list = field(default_factory=list)
    solde_annonce: float | None = None
    cumul_mois: float | None = None
    cumul_annuel: float | None = None

    @property
    def total_calcule(self) -> float:
        return round(sum((l.credit or 0) - (l.debit or 0) for l in self.lignes), 2)

    @property
    def ecart(self) -> float | None:
        """Écart entre ce qu'on a extrait et ce que le document annonce."""
        if self.cumul_mois is None:
            return None
        return round(self.total_calcule - self.cumul_mois, 2)

    @property
    def fiable(self) -> bool:
        """Vrai si l'extraction retombe sur le total du document (1 centime de tolérance)."""
        return self.ecart is not None and abs(self.ecart) <= 0.01

    def resume(self) -> dict:
        return {
            "compagnie": self.compagnie, "compte_producteur": self.compte_producteur,
            "periode": self.periode, "nb_lignes": len(self.lignes),
            "total_calcule": self.total_calcule, "cumul_mois": self.cumul_mois,
            "ecart": self.ecart, "fiable": self.fiable,
        }


def montant(txt: str) -> float:
    """'1.140,65' -> 1140.65 — format belge : point = millier, virgule = décimale."""
    return float(txt.replace(".", "").replace(",", "."))


# ──────────────────────────── AG Insurance ────────────────────────────
# Mise en page (le texte extrait du PDF est aplati sur une seule ligne) :
#   Contractant  [sinistre ou code sous-agent]  JJ/MM/AAAA  <code> <libellé>
#   <cat.>  <n° contrat>  R  <montant>  <jour>  <région>
# Le « R » marque une rémunération en notre faveur (colonne Crédit).
# AG porte le code du sous-agent directement sur la ligne quand il y en a un,
# ce qui évite tout rapprochement par nom.
_AG_LIGNE = re.compile(
    r"(?P<avant>[^\s].{0,60}?)\s+"
    r"(?P<date>\d{2}/\d{2}/\d{4})\s+"
    r"(?P<code>\d{3})\s+(?P<libelle>\S+(?:\s+\S+){0,3}?)\s+"
    r"(?P<cat>\d{3,4})\s+(?P<contrat>\d{6,10})\s+"
    r"(?P<sens>R)\s+(?P<montant>[\d.]*\d,\d{2})"
)
_AG_SA = re.compile(r"[A-Z]{3}")


def parse_ag(texte: str) -> Releve:
    """Relevé de compte producteur AG Insurance."""
    r = Releve(compagnie="AG")

    m = re.search(r"Compte N°\s+(\d+)", texte)
    if m:
        r.compte_producteur = m.group(1)

    m = re.search(r"Relev[ée] de compte Producteur au\s+(\d{2})/(\d{2})/(\d{4})", texte)
    if m:
        r.periode = f"{m.group(3)}-{m.group(2)}-01"

    m = re.search(r"Solde de votre compte\s+([\d.]*\d,\d{2})", texte)
    if m:
        r.solde_annonce = montant(m.group(1))

    # Les deux cumuls se suivent : mois puis année.
    m = re.search(r"Cumul Rémunérations annuelles[^\d]*([\d.]*\d,\d{2})\s+([\d.]*\d,\d{2})", texte)
    if m:
        r.cumul_mois, r.cumul_annuel = montant(m.group(1)), montant(m.group(2))

    for g in _AG_LIGNE.finditer(texte):
        # Le texte du PDF est aplati : « avant » contient la fin de la ligne
        # précédente (jour + région) puis le contractant, et parfois un n° de
        # sinistre ou un code sous-agent. Les colonnes restent séparées par au
        # moins deux espaces, ce qui permet de les retrouver.
        morceaux = [m.strip() for m in re.split(r"\s{2,}", g.group("avant")) if m.strip()]
        sa = None
        if morceaux and _AG_SA.fullmatch(morceaux[-1]):
            sa = morceaux.pop()
        if morceaux and re.fullmatch(r"\d{6,}", morceaux[-1]):
            morceaux.pop()                       # numéro de sinistre
        client = morceaux[-1] if morceaux else ""
        client = re.sub(r"^[\d.,\s]+", "", client).strip()   # reste de la ligne d'avant

        j, mo, a = g.group("date").split("/")
        r.lignes.append(Ligne(
            client_nom=client or None,
            police=g.group("contrat"),
            date_echeance=f"{a}-{mo}-{j}",
            code_operation=g.group("code"),
            libelle_operation=g.group("libelle").strip(),
            categorie=g.group("cat"),
            sous_agent_code=sa,
            credit=montant(g.group("montant")),
            ligne_brute=g.group(0).strip(),
        ))

    # Lignes forfaitaires sans contrat ni date (ex. « 637 Rémun. Familis »).
    for g in re.finditer(r"(\d{2}/\d{4})\s+(?P<code>63\d)\s+(?P<lib>[^\d]{3,30}?)\s+R\s+(?P<m>[\d.]*\d,\d{2})", texte):
        r.lignes.append(Ligne(
            code_operation=g.group("code"),
            libelle_operation=g.group("lib").strip(),
            credit=montant(g.group("m")),
            ligne_brute=g.group(0).strip(),
        ))

    return r


PARSEURS = {"AG": parse_ag}


if __name__ == "__main__":
    import sys, json
    if len(sys.argv) < 3:
        print("usage: rcp_parsers.py <COMPAGNIE> <fichier texte>")
        raise SystemExit(2)
    cie, chemin = sys.argv[1].upper(), sys.argv[2]
    parseur = PARSEURS.get(cie)
    if not parseur:
        print(f"Pas de parseur pour {cie}. Disponibles : {', '.join(PARSEURS)}")
        raise SystemExit(2)
    rel = parseur(open(chemin, encoding="utf-8").read())
    print(json.dumps(rel.resume(), indent=2, ensure_ascii=False))
    for l in rel.lignes:
        d = asdict(l)
        d.pop("ligne_brute")
        print("  ", {k: v for k, v in d.items() if v is not None})
    print("\nFIABLE ✓" if rel.fiable else f"\nNON FIABLE — écart de {rel.ecart} €")

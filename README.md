# SNCF Planner (TGVmax)

Application front-only (HTML/CSS/JS) qui interroge l'API Opendatasoft (dataset `tgvmax`) pour lister les trains disponibles au départ d'une gare à une date donnée, filtrés sur `od_happy_card = OUI`. Un clic sur un train affiche l'itinéraire et propose les correspondances depuis la gare d'arrivée, à une heure ultérieure. Hébergeable sur GitHub Pages.

## Utilisation

- Ouvrez `web/index.html` dans un navigateur ou servez le dossier `web/` via un serveur statique.
- Saisissez la gare de départ en MAJUSCULES (ex: `TOULOUSE MATABIAU`).
- Choisissez une date.
- Cliquez sur un train pour dérouler l'itinéraire et les correspondances.
- Bouton "Réinitialiser l’itinéraire" pour revenir à la recherche initiale.

## Données et API

- Source: https://data.sncf.com
- API: Opendatasoft Explore v2.1 (https://help.opendatasoft.com/apis/ods-explore-v2/explore_v2.1.html)
- Dataset: `tgvmax`
- Filtres utilisés:
  - `refine=date:"YYYY/MM/DD"`
  - `refine=origine:"<GARE>"`
  - `refine=od_happy_card:"OUI"`

Le code construit des URLs du type:
`https://data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/records?limit=90&refine=date:"2025/08/25"&refine=od_happy_card:"OUI"&refine=origine:"TOULOUSE MATABIAU"`

## Notes

- Le dataset `tgvmax` expose des champs comme `date`, `origine`, `destination`, `train_no`, `heure_depart`, `heure_arrivee`.
- Les noms de gare doivent correspondre exactement à ceux du dataset. La saisie est en majuscules pour maximiser les correspondances.
- Les correspondances sont calculées côté client en comparant les heures de départ/arrivée sur la même date.

## Déploiement GitHub Pages

- Placez le contenu de `web/` à la racine de la branche `gh-pages` de votre repo, ou configurez Pages pour servir le dossier `web/`.


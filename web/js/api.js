// Accès API Opendatasoft (dataset SNCF tgvmax) - version non-module

(function(){
  const { normalizeStationForApi, toRefineDate } = window.Utils;
  const ODS_BASE = 'https://data.sncf.com/api/explore/v2.1/catalog/datasets';
  const DATASET = 'tgvmax';
  const DEFAULT_LIMIT = 90;

  async function fetchTrains({ date, origin, destination, limit = DEFAULT_LIMIT }) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (date) params.append('refine', `date:"${toRefineDate(date)}"`);
    params.append('refine', 'od_happy_card:"OUI"');
    if (origin) params.append('refine', `origine:"${normalizeStationForApi(origin)}"`);
    if (destination) params.append('refine', `destination:"${normalizeStationForApi(destination)}"`);

    const url = `${ODS_BASE}/${DATASET}/records?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erreur API SNCF (${res.status})`);
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const normalized = results.map(r => ({
      date: r.date,
      origine: r.origine,
      destination: r.destination,
      heure_depart: r.heure_depart,
      heure_arrivee: r.heure_arrivee,
      train_no: r.train_no,
      axe: r.axe,
      entity: r.entity,
    }));
    normalized.sort((a, b) => (a.heure_depart || '').localeCompare(b.heure_depart || ''));
    return normalized;
  }

  // Récupération dynamique des gares disponibles via facette "origine"
  async function fetchStations({ date } = {}) {
    const params = new URLSearchParams();
    params.set('limit', '0'); // pas de records, seulement facets
    params.append('facet', 'origine');
    if (date) params.append('refine', `date:"${toRefineDate(date)}"`);
    params.append('refine', 'od_happy_card:"OUI"');
    const url = `${ODS_BASE}/${DATASET}/records?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erreur API SNCF (${res.status})`);
    const data = await res.json();
    const facets = data?.facets?.find(f => f.name === 'origine');
    const values = facets?.facets?.map(f => f.name).filter(Boolean) || [];
    // trier alpha
    values.sort((a, b) => a.localeCompare(b));
    return values;
  }

  window.Api = { fetchTrains, fetchStations };
})();

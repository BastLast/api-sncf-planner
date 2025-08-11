// Accès API Opendatasoft (dataset SNCF tgvmax)

import { normalizeStationForApi, toRefineDate } from './utils.js';

const ODS_BASE = 'https://data.sncf.com/api/explore/v2.1/catalog/datasets';
const DATASET = 'tgvmax';
const DEFAULT_LIMIT = 200;

export async function fetchTrains({ date, origin, destination, limit = DEFAULT_LIMIT }) {
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

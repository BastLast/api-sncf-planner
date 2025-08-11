// Utilitaires généraux

export const STATION_SYNONYMS = {
  'LYON': 'LYON (intramuros)',
  'PARIS': 'PARIS (intramuros)',
  'MARSEILLE': 'MARSEILLE (intramuros)',
  'LILLE': 'LILLE (intramuros)',
  'BORDEAUX': 'BORDEAUX (intramuros)'
};

export function normalizeStationForApi(raw) {
  const s = (raw || '').trim();
  const upper = s.toUpperCase();
  if (STATION_SYNONYMS[upper]) return STATION_SYNONYMS[upper];
  // Par défaut, tenter UPPERCASE pour coller au dataset souvent en majuscules
  return upper;
}

// Convertit 'YYYY-MM-DD' -> 'YYYY/MM/DD' pour le refine date
export function toRefineDate(dateStr) {
  return (dateStr || '').replaceAll('-', '/');
}

// Parse un datetime local à partir de date 'YYYY-MM-DD' et heure 'HH:MM'
export function parseDateTime(dateStr, timeStr) {
  const [year, month, day] = (dateStr || '1970-01-01').split('-').map(Number);
  const [hour, minute] = (timeStr || '00:00').split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
}

export function formatDateTime(dt) {
  return dt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatDate(dateStr) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR');
  } catch {
    return dateStr;
  }
}

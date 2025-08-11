// Utilitaires (global window.Utils)
window.Utils = (function () {
  function normalizeStationForApi(raw) {
    // Pas de mapping forcé: on utilise la saisie de l’utilisateur (trim) ou la valeur exacte de l’API
    return (raw || '').trim();
  }

  function toRefineDate(dateStr) {
    return (dateStr || '').replaceAll('-', '/');
  }

  function parseDateTime(dateStr, timeStr) {
    const [year, month, day] = (dateStr || '1970-01-01').split('-').map(Number);
    const [hour, minute] = (timeStr || '00:00').split(':').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
  }

  function formatDateTime(dt) {
    return dt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function formatDate(dateStr) {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('fr-FR');
    } catch {
      return dateStr;
    }
  }

  // Nouvelle fonction pour valider une date de recherche
  function isValidSearchDate(dateStr) {
    if (!dateStr) return false;
    
    try {
      const selectedDate = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return selectedDate >= today && !isNaN(selectedDate.getTime());
    } catch {
      return false;
    }
  }

  return { 
    normalizeStationForApi, 
    toRefineDate, 
    parseDateTime, 
    formatDateTime, 
    formatDate,
    isValidSearchDate
  };
})();

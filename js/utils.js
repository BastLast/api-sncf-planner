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

  // Calcule la durée entre deux heures (format HH:MM)
  function calculateDuration(departTime, arrivalTime) {
    if (!departTime || !arrivalTime) return null;
    
    try {
      const [depHour, depMin] = departTime.split(':').map(Number);
      const [arrHour, arrMin] = arrivalTime.split(':').map(Number);
      
      let depMinutes = depHour * 60 + depMin;
      let arrMinutes = arrHour * 60 + arrMin;
      
      // Gérer le cas où l'arrivée est le lendemain
      if (arrMinutes < depMinutes) {
        arrMinutes += 24 * 60;
      }
      
      const durationMinutes = arrMinutes - depMinutes;
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      
      if (hours === 0) {
        return `${minutes}min`;
      } else if (minutes === 0) {
        return `${hours}h`;
      } else {
        return `${hours}h${minutes.toString().padStart(2, '0')}`;
      }
    } catch {
      return null;
    }
  }

  // Calcule la durée entre deux dates complètes (DateTime)
  function calculateSegmentDuration(startDateTime, endDateTime) {
    if (!startDateTime || !endDateTime) return null;
    
    try {
      const durationMs = endDateTime.getTime() - startDateTime.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      
      if (durationMinutes < 0) return null;
      
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      
      if (hours === 0) {
        return `${minutes}min`;
      } else if (minutes === 0) {
        return `${hours}h`;
      } else {
        return `${hours}h${minutes.toString().padStart(2, '0')}`;
      }
    } catch {
      return null;
    }
  }

  // Ajouter des jours à une date (format YYYY-MM-DD)
  function addDaysToDate(dateStr, days) {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + days);
      
      const newYear = date.getFullYear();
      const newMonth = (date.getMonth() + 1).toString().padStart(2, '0');
      const newDay = date.getDate().toString().padStart(2, '0');
      
      return `${newYear}-${newMonth}-${newDay}`;
    } catch {
      return dateStr;
    }
  }

  // Obtenir les dates suivantes (pour les boutons de changement de jour)
  function getNextDates(baseDate, count = 3) {
    const dates = [];
    for (let i = 1; i <= count; i++) {
      const nextDate = addDaysToDate(baseDate, i);
      dates.push({
        date: nextDate,
        label: formatDate(nextDate)
      });
    }
    return dates;
  }

  return { 
    normalizeStationForApi, 
    toRefineDate, 
    parseDateTime, 
    formatDateTime, 
    formatDate,
    isValidSearchDate,
    calculateDuration,
    calculateSegmentDuration,
    addDaysToDate,
    getNextDates
  };
})();

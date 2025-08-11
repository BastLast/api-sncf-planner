// Entrée principale (module)

import { fetchTrains } from './api.js';
import { parseDateTime, formatDate, formatDateTime, normalizeStationForApi } from './utils.js';
import { renderTrainItem, renderItinerarySegments, showLoading, showError, showResultsHeader, renderResetButton } from './ui.js';

const form = document.getElementById('searchForm');
const resultsDiv = document.getElementById('results');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawCity = document.getElementById('city').value;
  const city = normalizeStationForApi(rawCity);
  const date = document.getElementById('date').value;

  showLoading(resultsDiv, 'Chargement des trains…');
  form.style.display = 'none';

  try {
    const trains = await fetchTrains({ date, origin: city });
    if (!trains.length) {
      resultsDiv.innerHTML = '<p>Aucun train trouvé pour cette gare à cette date (TGVmax/Happy Card).</p>';
      form.style.display = '';
      return;
    }
    showResultsHeader(resultsDiv, city, formatDate(date));
    trains.forEach((t) => {
      const item = renderTrainItem(t);
      item.addEventListener('click', () => showItinerary(city, date, t, []));
      resultsDiv.appendChild(item);
    });
  } catch (err) {
    showError(resultsDiv, `Erreur lors du chargement: ${err.message}`);
    form.style.display = '';
  }
});

async function showItinerary(departVille, departDate, train, parcours = []) {
  const departDateTime = parseDateTime(departDate, train.heure_depart || train.heure || '00:00');
  const arriveeDateTime = train.heure_arrivee ? parseDateTime(departDate, train.heure_arrivee) : departDateTime;

  const segment = {
    depart: departVille,
    departDateTime,
    train: {
      numero: train.train_no || train.numero || '',
      destination: train.destination,
      heure: train.heure_depart || train.heure,
    },
    arrivee: train.destination,
    arriveeDateTime,
  };

  const nouveauParcours = [...parcours, segment];

  let header = renderItinerarySegments(nouveauParcours);
  header += `<h3>Trains disponibles depuis ${train.destination} après ${formatDateTime(arriveeDateTime)}</h3>`;
  resultsDiv.innerHTML = header;
  showLoading(resultsDiv, 'Chargement des correspondances…');

  try {
    const allNext = await fetchTrains({ date: departDate, origin: train.destination });
    const nextTrains = allNext.filter(t => {
      const tDateTime = parseDateTime(departDate, t.heure_depart || '00:00');
      return tDateTime > arriveeDateTime;
    });

    resultsDiv.innerHTML = header;
    if (!nextTrains.length) {
      const p = document.createElement('p');
      p.textContent = 'Aucun train disponible après cette heure.';
      resultsDiv.appendChild(p);
    } else {
      nextTrains.forEach(t => {
        const item = renderTrainItem(t);
        item.addEventListener('click', () => showItinerary(train.destination, departDate, t, nouveauParcours));
        resultsDiv.appendChild(item);
      });
    }
  } catch (err) {
    const p = document.createElement('p');
    p.textContent = `Erreur lors du chargement des correspondances: ${err.message}`;
    resultsDiv.appendChild(p);
  }

  const reset = renderResetButton(() => {
    resultsDiv.innerHTML = '';
    form.reset();
    form.style.display = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  resultsDiv.appendChild(reset);
}

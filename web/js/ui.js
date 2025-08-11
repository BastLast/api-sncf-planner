// Fonctions de rendu UI

import { formatDateTime } from './utils.js';

export function renderTrainItem(train) {
  const div = document.createElement('div');
  div.className = 'train card';
  const numero = train.train_no ? `Train ${train.train_no}` : 'Train';
  const heure = train.heure_depart || '?';
  const dest = train.destination || '?';
  const arr = train.heure_arrivee ? ` (arrivée ${train.heure_arrivee})` : '';
  div.innerHTML = `
    <div class="card-header">
      <span class="badge">${heure}</span>
      <strong>${numero}</strong>
    </div>
    <div class="card-body">
      <span class="to">→ ${dest}${arr}</span>
    </div>`;
  div.style.cursor = 'pointer';
  return div;
}

export function renderItinerarySegments(segments) {
  let html = '<h2>Itinéraire</h2>';
  segments.forEach((seg, i) => {
    html += `<div class="itineraire-segment card subtle">
      <p><strong>Étape ${i + 1}</strong></p>
      <p>Départ : ${seg.depart} le ${formatDateTime(seg.departDateTime)}</p>
      <p>Train : ${seg.train.numero || '—'} vers ${seg.train.destination || '—'} (départ ${seg.train.heure || '—'})</p>
      <p>Arrivée : ${seg.arrivee} le ${formatDateTime(seg.arriveeDateTime)}</p>
    </div>`;
  });
  return html;
}

export function showLoading(container, text = 'Chargement…') {
  container.innerHTML = `<div class="loader"><div class="spinner"></div><span>${text}</span></div>`;
}

export function showError(container, message) {
  container.innerHTML = `<p class="error">${message}</p>`;
}

export function showResultsHeader(container, origin, dateText) {
  container.innerHTML = `<h2>Trains au départ de ${origin} le ${dateText}</h2>`;
}

export function renderResetButton(onClick) {
  const btn = document.createElement('button');
  btn.id = 'resetBtn';
  btn.textContent = 'Réinitialiser l’itinéraire';
  btn.className = 'btn-danger';
  btn.onclick = onClick;
  return btn;
}

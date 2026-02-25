// Auto Itinerary Planner – solver + UI integration
window.AutoPlanner = (function () {
  'use strict';

  const { fetchTrains } = window.Api;
  const {
    parseDateTime,
    addDaysToDate,
    dateToDateStr,
    formatDate,
    formatDateTime,
    countNights,
    normalizeStationForApi,
  } = window.Utils;
  const { renderItinerarySegments, showLoading, showError, renderResetButton } =
    window.UI;

  /* ── Configuration ── */
  const MIN_CONNECTION_MIN = 30; // minimum minutes between connection trains
  const MAX_DAYS_AHEAD = 5; // how many extra days to search per leg
  const MAX_INTERMEDIATES = 12; // max intermediate cities to try for connections
  const CONNECTION_BATCH = 6; // parallel API calls for connection search

  /* ═══════════════════════════════════════════
     SOLVER
     ═══════════════════════════════════════════ */

  /** Build a segment matching the format used by the manual itinerary renderer */
  function buildSegment(from, to, train, date) {
    const depDT = parseDateTime(date, train.heure_depart);
    let arrDT = parseDateTime(
      date,
      train.heure_arrivee || train.heure_depart
    );
    if (arrDT <= depDT) arrDT = new Date(arrDT.getTime() + 86400000);
    return {
      depart: from,
      departDateTime: depDT,
      train: {
        numero: train.train_no || '',
        destination: train.destination,
        heure: train.heure_depart,
      },
      arrivee: to,
      arriveeDateTime: arrDT,
    };
  }

  /** Try a direct train from→to on the given date, departing after afterTime */
  async function tryDirect(from, to, date, afterTime) {
    const trains = await fetchTrains({ date, origin: from, destination: to });
    const valid = afterTime
      ? trains.filter((t) => t.heure_depart > afterTime)
      : trains;
    if (!valid.length) return null;

    // Pick the train with earliest arrival time (not earliest departure)
    let bestTrain = valid[0];
    let bestSeg = buildSegment(from, to, bestTrain, date);
    for (let i = 1; i < valid.length; i++) {
      const seg = buildSegment(from, to, valid[i], date);
      if (seg.arriveeDateTime < bestSeg.arriveeDateTime) {
        bestTrain = valid[i];
        bestSeg = seg;
      }
    }
    return { segments: [bestSeg], arrivalDT: bestSeg.arriveeDateTime };
  }

  /** Try 1-connection route from→mid→to (parallel intermediate search) */
  async function tryOneConnection(from, to, date, afterTime, excludeCities) {
    const fromTrains = await fetchTrains({ date, origin: from });
    const valid = afterTime
      ? fromTrains.filter((t) => t.heure_depart > afterTime)
      : fromTrains;

    if (!valid.length) return null;

    // Group trains by destination, keep up to 3 per intermediate (earliest departures)
    const byDest = {};
    for (const t of valid) {
      const d = t.destination;
      if (!byDest[d]) byDest[d] = [];
      if (byDest[d].length < 3) byDest[d].push(t);
    }

    const mids = Object.keys(byDest)
      .filter((d) => d !== from && d !== to && (!excludeCities || !excludeCities.has(d)))
      .sort((a, b) =>
        (byDest[a][0].heure_arrivee || '').localeCompare(
          byDest[b][0].heure_arrivee || ''
        )
      )
      .slice(0, MAX_INTERMEDIATES);

    if (!mids.length) return null;

    // Search mid→to in parallel, trying multiple trains per intermediate
    const results = await Promise.allSettled(
      mids.map(async (mid) => {
        let bestForMid = null;
        for (const t1 of byDest[mid]) {
          const seg1 = buildSegment(from, mid, t1, date);
          const connTime = new Date(
            seg1.arriveeDateTime.getTime() + MIN_CONNECTION_MIN * 60000
          );
          const connTimeStr = connTime.toTimeString().slice(0, 5);
          const searchDate2 = dateToDateStr(connTime);

          const midTrains = await fetchTrains({
            date: searchDate2,
            origin: mid,
            destination: to,
          });
          const validMid = midTrains.filter((t) => {
            if (searchDate2 === date) return t.heure_depart >= connTimeStr;
            return true;
          });
          if (!validMid.length) continue;

          const seg2 = buildSegment(mid, to, validMid[0], searchDate2);
          const candidate = { segments: [seg1, seg2], arrivalDT: seg2.arriveeDateTime };
          if (!bestForMid || candidate.arrivalDT < bestForMid.arrivalDT) {
            bestForMid = candidate;
          }
        }
        return bestForMid;
      })
    );

    // Pick best (earliest arrival)
    let best = null;
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        if (!best || r.value.arrivalDT < best.arrivalDT) {
          best = r.value;
        }
      }
    }
    return best;
  }

  /** Find fastest route for one leg (compares direct vs connection, picks earliest arrival) */
  async function findRoute(from, to, date, afterTime, onProgress, excludeCities) {
    for (let d = 0; d <= MAX_DAYS_AHEAD; d++) {
      const searchDate = d === 0 ? date : addDaysToDate(date, d);
      const time = d === 0 ? afterTime : null;

      if (onProgress)
        onProgress(
          `Recherche ${from} → ${to} le ${formatDate(searchDate)}…`
        );

      // Try direct and connection in parallel, pick best overall
      const [direct, conn] = await Promise.all([
        tryDirect(from, to, searchDate, time),
        tryOneConnection(from, to, searchDate, time, excludeCities),
      ]);

      // Pick the route with earliest arrival
      let best = null;
      if (direct && conn) {
        best = direct.arrivalDT <= conn.arrivalDT ? direct : conn;
      } else {
        best = direct || conn;
      }

      if (best) return best;
    }
    return null;
  }

  /**
   * Solve a multi-leg itinerary.
   * @param {Object} config
   * @param {string} config.departure
   * @param {string} config.arrival
   * @param {string} config.startDate - YYYY-MM-DD
   * @param {Array}  config.waypoints - [{city, minNights}]
   * @param {Function} onProgress - callback(message)
   * @returns {Object} { success, segments, error? }
   */
  async function solve(config, onProgress) {
    const { departure, arrival, startDate, waypoints = [] } = config;
    const cities = [departure, ...waypoints.map((w) => w.city), arrival];

    // Map waypoint city → minNights
    const nightsMap = {};
    waypoints.forEach((w) => {
      nightsMap[w.city] = w.minNights || 0;
    });

    const allSegments = [];
    let currentDate = startDate;
    let afterTime = null;
    // Track visited cities to avoid backwards connections
    const visitedCities = new Set();
    visitedCities.add(departure);

    for (let i = 0; i < cities.length - 1; i++) {
      const from = cities[i];
      const to = cities[i + 1];

      // Apply min nights at current city (skip departure on first leg)
      if (i > 0 && nightsMap[from] > 0) {
        if (onProgress)
          onProgress(
            `${nightsMap[from]} nuit(s) à ${from}, reprise le ${formatDate(addDaysToDate(currentDate, nightsMap[from]))}…`
          );
        currentDate = addDaysToDate(currentDate, nightsMap[from]);
        afterTime = null;
      }

      const route = await findRoute(from, to, currentDate, afterTime, onProgress, visitedCities);
      if (!route) {
        return {
          success: false,
          segments: allSegments,
          error: `Aucun trajet trouvé de ${from} à ${to} (à partir du ${formatDate(currentDate)}, ${MAX_DAYS_AHEAD + 1} jours testés).`,
        };
      }

      allSegments.push(...route.segments);

      // Track visited cities to prevent backwards connections
      for (const seg of route.segments) {
        visitedCities.add(seg.depart);
        visitedCities.add(seg.arrivee);
      }

      const lastSeg = route.segments[route.segments.length - 1];
      currentDate = dateToDateStr(lastSeg.arriveeDateTime);
      afterTime = lastSeg.arriveeDateTime.toTimeString().slice(0, 5);
    }

    return { success: true, segments: allSegments };
  }

  /* ═══════════════════════════════════════════
     UI
     ═══════════════════════════════════════════ */

  let waypointCounter = 0;

  function createWaypointEntry() {
    waypointCounter++;
    const div = document.createElement('div');
    div.className = 'waypoint-entry';
    div.innerHTML = `
      <div class="waypoint-city">
        <input list="stations" class="waypoint-city-input" placeholder="Ville étape" required autocomplete="off">
      </div>
      <div class="waypoint-nights">
        <label>Nuits min :</label>
        <input type="number" class="waypoint-nights-input" min="0" value="1">
      </div>
      <div class="waypoint-actions">
        <button type="button" class="waypoint-move-up btn-icon" title="Monter">▲</button>
        <button type="button" class="waypoint-move-down btn-icon" title="Descendre">▼</button>
        <button type="button" class="waypoint-remove btn-icon btn-icon-danger" title="Supprimer">✕</button>
      </div>
    `;

    div
      .querySelector('.waypoint-remove')
      .addEventListener('click', () => div.remove());
    div
      .querySelector('.waypoint-move-up')
      .addEventListener('click', () => {
        const prev = div.previousElementSibling;
        if (prev) div.parentNode.insertBefore(div, prev);
      });
    div
      .querySelector('.waypoint-move-down')
      .addEventListener('click', () => {
        const next = div.nextElementSibling;
        if (next) div.parentNode.insertBefore(next, div);
      });

    return div;
  }

  function getWaypoints() {
    const entries = document.querySelectorAll(
      '#waypoints-list .waypoint-entry'
    );
    return Array.from(entries)
      .map((el) => ({
        city: el.querySelector('.waypoint-city-input').value.trim(),
        minNights:
          parseInt(el.querySelector('.waypoint-nights-input').value, 10) || 0,
      }))
      .filter((w) => w.city);
  }

  /** Render the final auto-planner results */
  function renderAutoResults(container, segments, departure, arrival, waypoints) {
    // Title
    const title = document.createElement('h2');
    title.className = 'auto-result-title';
    const waypointText = waypoints.length
      ? ` via ${waypoints.map((w) => w.city).join(', ')}`
      : '';
    title.textContent = `Itinéraire ${departure} → ${arrival}${waypointText}`;
    container.appendChild(title);

    // Summary card
    const summary = document.createElement('div');
    summary.className = 'auto-summary card';

    const totalDurationMs =
      segments[segments.length - 1].arriveeDateTime.getTime() -
      segments[0].departDateTime.getTime();
    const totalMinutes = Math.floor(totalDurationMs / 60000);
    const totalDays = Math.floor(totalMinutes / 1440);
    const remainHours = Math.floor((totalMinutes % 1440) / 60);
    const remainMin = totalMinutes % 60;

    let durationText = '';
    if (totalDays > 0) durationText += `${totalDays}j `;
    durationText += `${remainHours}h`;
    if (remainMin > 0) durationText += `${remainMin.toString().padStart(2, '0')}`;

    // Count total nights
    let totalNights = 0;
    for (let i = 0; i < segments.length - 1; i++) {
      totalNights += countNights(
        segments[i].arriveeDateTime,
        segments[i + 1].departDateTime
      );
    }

    summary.innerHTML = `
      <div class="auto-summary-content">
        <div class="summary-stat">
          <span class="summary-label">🚉 Départ</span>
          <span class="summary-value">${formatDateTime(segments[0].departDateTime)}</span>
        </div>
        <div class="summary-stat">
          <span class="summary-label">🏁 Arrivée</span>
          <span class="summary-value">${formatDateTime(segments[segments.length - 1].arriveeDateTime)}</span>
        </div>
        <div class="summary-stat">
          <span class="summary-label">⏱️ Durée totale</span>
          <span class="summary-value">${durationText}</span>
        </div>
        <div class="summary-stat">
          <span class="summary-label">🚄 Trains</span>
          <span class="summary-value">${segments.length}</span>
        </div>
        ${
          totalNights > 0
            ? `<div class="summary-stat">
                <span class="summary-label">🌙 Nuits</span>
                <span class="summary-value">${totalNights}</span>
              </div>`
            : ''
        }
      </div>
    `;
    container.appendChild(summary);

    // Itinerary segments (reuse existing renderer)
    container.appendChild(renderItinerarySegments(segments));

    // Transfer to manual mode button
    const transferBtn = document.createElement('button');
    transferBtn.type = 'button';
    transferBtn.className = 'btn-secondary btn-transfer';
    transferBtn.textContent = '✏️ Modifier dans la recherche manuelle';
    transferBtn.addEventListener('click', () => {
      transferToManual(segments);
    });
    container.appendChild(transferBtn);

    // Update map if available
    if (window.TrainMap && typeof window.TrainMap.showItinerary === 'function') {
      window.TrainMap.showItinerary(segments, []).catch(() => {});
    }
  }

  /** Transfer auto itinerary segments to the manual mode for editing */
  function transferToManual(segments) {
    if (!segments.length) return;

    // Switch to manual tab
    const modeTabs = document.querySelectorAll('.mode-tab');
    const searchForm = document.getElementById('searchForm');
    const autoForm = document.getElementById('autoForm');

    modeTabs.forEach((t) => {
      const isManual = t.dataset.mode === 'manual';
      t.classList.toggle('active', isManual);
      t.setAttribute('aria-selected', isManual ? 'true' : 'false');
    });
    searchForm.style.display = 'none'; // keep hidden, manual itinerary takes over
    autoForm.style.display = 'none';

    // Use the exposed showItinerary function from app.js
    // showItinerary(departVille, departDate, train, parcours) adds one segment and shows connections.
    // We pass all segments except the last as parcours, and the last segment as the new train.
    const lastSeg = segments[segments.length - 1];
    const previousSegments = segments.slice(0, -1);
    const lastTrain = {
      train_no: lastSeg.train.numero,
      destination: lastSeg.arrivee,
      heure_depart: lastSeg.train.heure,
      heure_arrivee: lastSeg.arriveeDateTime.toTimeString().slice(0, 5),
    };
    const lastDateStr = dateToDateStr(lastSeg.departDateTime);

    if (typeof window.showItinerary === 'function') {
      window.showItinerary(lastSeg.depart, lastDateStr, lastTrain, previousSegments);
    }
  }

  /** Initialize the auto planner form and event handlers */
  function init(resultsDiv, onReset) {
    const autoForm = document.getElementById('autoForm');
    if (!autoForm) return;

    const waypointsList = document.getElementById('waypoints-list');
    const addBtn = document.getElementById('add-waypoint');
    const autoDateInput = document.getElementById('auto-date');

    // Set min date
    autoDateInput.min = new Date().toISOString().split('T')[0];

    // Add waypoint
    addBtn.addEventListener('click', () => {
      waypointsList.appendChild(createWaypointEntry());
    });

    // Form submit
    autoForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const departure = document.getElementById('auto-departure').value.trim();
      const arrival = document.getElementById('auto-arrival').value.trim();
      const startDate = autoDateInput.value;

      if (!departure || !arrival || !startDate) {
        showError(resultsDiv, 'Veuillez remplir tous les champs obligatoires.');
        return;
      }

      const waypoints = getWaypoints();

      if (departure === arrival && waypoints.length === 0) {
        showError(resultsDiv, 'La gare de départ et d\'arrivée doivent être différentes (ou ajoutez des étapes pour un aller-retour).');
        return;
      }

      // Validate waypoints: ensure no consecutive duplicates
      const allCities = [departure, ...waypoints.map(w => w.city), arrival];
      for (let i = 0; i < allCities.length - 1; i++) {
        if (allCities[i] === allCities[i + 1]) {
          showError(
            resultsDiv,
            `Deux étapes consécutives identiques : "${allCities[i]}".`
          );
          return;
        }
      }

      // Validate date
      const dateObj = new Date(startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dateObj < today) {
        showError(resultsDiv, 'Veuillez sélectionner une date future.');
        return;
      }

      autoForm.style.display = 'none';
      resultsDiv.innerHTML = '';

      // Progress element
      const progressDiv = document.createElement('div');
      progressDiv.className = 'auto-progress';
      progressDiv.innerHTML =
        '<div class="spinner"></div><span class="progress-text">Démarrage de la recherche…</span>';
      resultsDiv.appendChild(progressDiv);

      const onProgress = (msg) => {
        const span = progressDiv.querySelector('.progress-text');
        if (span) span.textContent = msg;
      };

      try {
        const result = await solve(
          {
            departure: normalizeStationForApi(departure),
            arrival: normalizeStationForApi(arrival),
            startDate,
            waypoints: waypoints.map((w) => ({
              city: normalizeStationForApi(w.city),
              minNights: w.minNights,
            })),
          },
          onProgress
        );

        resultsDiv.innerHTML = '';

        if (result.success) {
          renderAutoResults(
            resultsDiv,
            result.segments,
            departure,
            arrival,
            waypoints
          );
        } else {
          // Partial results + error
          if (result.segments.length > 0) {
            const partial = document.createElement('div');
            partial.className = 'partial-results';
            const h3 = document.createElement('h3');
            h3.textContent = 'Résultat partiel (étapes trouvées)';
            partial.appendChild(h3);
            partial.appendChild(renderItinerarySegments(result.segments));
            resultsDiv.appendChild(partial);
          }
          const errorDiv = document.createElement('div');
          errorDiv.className = 'error';
          errorDiv.textContent = result.error;
          resultsDiv.appendChild(errorDiv);
        }

        // Reset button
        const resetBtn = renderResetButton(() => {
          resultsDiv.innerHTML = '';
          autoForm.style.display = '';
          autoForm.reset();
          waypointsList.innerHTML = '';
          window.scrollTo({ top: 0, behavior: 'smooth' });
          if (onReset) onReset();
        });
        resultsDiv.appendChild(resetBtn);
      } catch (err) {
        resultsDiv.innerHTML = '';
        showError(resultsDiv, `Erreur inattendue : ${err.message}`);
        const resetBtn = renderResetButton(() => {
          resultsDiv.innerHTML = '';
          autoForm.style.display = '';
          window.scrollTo({ top: 0, behavior: 'smooth' });
          if (onReset) onReset();
        });
        resultsDiv.appendChild(resetBtn);
      }
    });
  }

  return { solve, init };
})();

// Module carte interactive (global window.TrainMap)
(function () {
  // ── API de géolocalisation des gares SNCF ──
  const GARES_API = 'https://data.sncf.com/api/explore/v2.1/catalog/datasets/liste-des-gares/records';
  const CACHE_KEY = 'sncf_station_coords_v2';
  const BATCH_SIZE = 100;
  const PARALLEL_LIMIT = 6;

  // Lookup normalisé : NOM_NORMALISE → [lat, lon]
  let stationLookup = {};
  let lookupReady = false;
  let lookupPromise = null;

  // Coordonnées spéciales pour les gares « intramuros » et gares TGV hors commune
  const specialCoords = {
    'PARIS (INTRAMUROS)':          [48.8566, 2.3522],
    'LYON (INTRAMUROS)':           [45.7600, 4.8590],
    'LILLE (INTRAMUROS)':          [50.6380, 3.0700],
    'BRUXELLES MIDI':              [50.8358, 4.3364],
    'KARLSRUHE HBF':               [49.0097, 8.4022],
    'FRANKFURT AM MAIN HBF':       [50.1072, 8.6637],
    'MANNHEIM HBF':                [49.4797, 8.4699],
    'LUXEMBOURG':                  [49.5999, 6.1334],
  };

  /** Normalise un nom de gare pour le matching */
  function normalizeName(name) {
    return name
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire accents
      .replace(/[-–—]/g, ' ')
      .replace(/[''`]/g, '')
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Charge toutes les gares voyageurs depuis l'API SNCF (avec cache localStorage) */
  async function loadAllStationCoords() {
    if (lookupReady) return;
    if (lookupPromise) return lookupPromise;

    lookupPromise = (async () => {
      // 1) Vérifier le cache localStorage
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          stationLookup = JSON.parse(cached);
          lookupReady = true;
          console.log(`${Object.keys(stationLookup).length} coordonnées de gares chargées depuis le cache`);
          return;
        }
      } catch (e) { /* cache corrompu, on re-fetch */ }

      // 2) Récupérer le nombre total de gares voyageurs
      let totalCount = 3300; // fallback
      try {
        const countResp = await fetch(`${GARES_API}?select=libelle&where=voyageurs%3D%22O%22&limit=0`);
        const countData = await countResp.json();
        totalCount = countData.total_count || totalCount;
      } catch (e) { /* utilise le fallback */ }

      // 3) Fetch toutes les gares en parallèle par lots
      const totalBatches = Math.ceil(totalCount / BATCH_SIZE);
      const allResults = [];

      for (let i = 0; i < totalBatches; i += PARALLEL_LIMIT) {
        const batchPromises = [];
        for (let j = i; j < Math.min(i + PARALLEL_LIMIT, totalBatches); j++) {
          const offset = j * BATCH_SIZE;
          batchPromises.push(
            fetch(`${GARES_API}?select=libelle,c_geo&where=voyageurs%3D%22O%22&limit=${BATCH_SIZE}&offset=${offset}`)
              .then(r => r.json())
              .then(d => d.results || [])
              .catch(() => [])
          );
        }
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(arr => allResults.push(...arr));
      }

      // 4) Construire le lookup normalisé
      stationLookup = {};
      allResults.forEach(station => {
        if (station.c_geo && station.libelle) {
          const key = normalizeName(station.libelle);
          // Garder la première occurrence (évite doublons)
          if (!stationLookup[key]) {
            stationLookup[key] = [station.c_geo.lat, station.c_geo.lon];
          }
        }
      });

      // 5) Sauvegarder en cache
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(stationLookup));
      } catch (e) { /* localStorage plein, on continue sans cache */ }

      lookupReady = true;
      console.log(`${Object.keys(stationLookup).length} coordonnées de gares chargées depuis l'API SNCF`);
    })();

    return lookupPromise;
  }

  /** Génère les variantes SAINT↔ST d'un nom normalisé */
  function saintVariants(name) {
    const variants = [name];
    if (/\bSAINT\b/.test(name)) variants.push(name.replace(/\bSAINT\b/g, 'ST'));
    if (/\bST\b/.test(name)) variants.push(name.replace(/\bST\b/g, 'SAINT'));
    if (/\bSAINTE\b/.test(name)) variants.push(name.replace(/\bSAINTE\b/g, 'STE'));
    if (/\bSTE\b/.test(name)) variants.push(name.replace(/\bSTE\b/g, 'SAINTE'));
    return variants;
  }

  /** Résout les coordonnées d'une gare TGVmax par son nom */
  function getCoords(stationName) {
    if (!stationName) return null;

    // 1) Vérifier les gares spéciales (intramuros, étrangères)
    const upper = stationName.toUpperCase().trim();
    if (specialCoords[upper]) return specialCoords[upper];

    // 2) Chercher dans le lookup normalisé (+ variantes SAINT/ST)
    const normalized = normalizeName(stationName);
    for (const v of saintVariants(normalized)) {
      if (stationLookup[v]) return stationLookup[v];
    }

    // 3) Essayer sans les suffixes courants (GARE SNCF, BATIMENT VOYAGEURS, etc.)
    const cleaned = normalized
      .replace(/\s*GARE SNCF\s*/, '')
      .replace(/\s*BATIMENT VOYAGEURS\s*/, '')
      .replace(/\s*\(.*?\)\s*/g, '')
      .trim();
    if (cleaned !== normalized) {
      for (const v of saintVariants(cleaned)) {
        if (stationLookup[v]) return stationLookup[v];
      }
    }

    // 4) Chercher par correspondance partielle (le nom TGVmax contient le nom API)
    const allVariants = saintVariants(normalized);
    for (const [key, coords] of Object.entries(stationLookup)) {
      for (const v of allVariants) {
        if (key.includes(v) || v.includes(key)) return coords;
      }
    }

    return null;
  }

  let map = null;
  let markersLayer = null;
  let routeLayer = null;
  let originMarker = null;

  // Icône personnalisée
  function createStationIcon(color, size) {
    return L.divIcon({
      className: 'map-station-icon',
      html: `<div style="
        background: ${color};
        width: ${size}px; height: ${size}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  }

  // Initialiser la carte
  function initMap(containerId) {
    if (map) map.remove();

    map = L.map(containerId, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([46.8, 2.5], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);

    // Lancer le chargement des coordonnées en arrière-plan
    loadAllStationCoords();

    return map;
  }

  // Afficher les destinations disponibles sur la carte (async)
  async function showDestinations(origin, destinations, onDestinationClick) {
    if (!map) return;
    await loadAllStationCoords();

    markersLayer.clearLayers();
    routeLayer.clearLayers();

    const originCoords = getCoords(origin);
    if (!originCoords) {
      console.warn('Coordonnées inconnues pour la gare d\'origine :', origin);
      return;
    }

    originMarker = L.marker(originCoords, {
      icon: createStationIcon('#e63946', 18)
    })
      .bindPopup(`<strong>${origin}</strong><br>🚉 Gare de départ`)
      .addTo(markersLayer);

    const bounds = L.latLngBounds([originCoords]);
    let missingCount = 0;

    destinations.forEach(({ name, trainCount }) => {
      const coords = getCoords(name);
      if (!coords) {
        missingCount++;
        return;
      }

      bounds.extend(coords);

      L.polyline([originCoords, coords], {
        color: '#6366f1',
        weight: 1.5,
        opacity: 0.25,
        dashArray: '4 4'
      }).addTo(routeLayer);

      const marker = L.marker(coords, {
        icon: createStationIcon('#6366f1', 12)
      })
        .bindPopup(`<strong>${name}</strong><br>🚆 ${trainCount} train${trainCount > 1 ? 's' : ''}`)
        .addTo(markersLayer);

      marker.on('click', () => {
        if (onDestinationClick) onDestinationClick(name);
      });
    });

    if (missingCount > 0) {
      console.warn(`${missingCount} gare(s) sans coordonnées sur ${destinations.length}`);
    }

    map.fitBounds(bounds.pad(0.1));
  }

  // Afficher l'itinéraire construit sur la carte (async)
  async function showItinerary(parcours, availableDestinations) {
    if (!map) return;
    await loadAllStationCoords();

    markersLayer.clearLayers();
    routeLayer.clearLayers();

    if (!parcours.length) return;

    const bounds = L.latLngBounds([]);
    const routePoints = [];

    parcours.forEach((seg, i) => {
      const departCoords = getCoords(seg.depart);
      const arriveeCoords = getCoords(seg.arrivee);

      if (departCoords) {
        bounds.extend(departCoords);
        routePoints.push(departCoords);

        if (i === 0) {
          L.marker(departCoords, { icon: createStationIcon('#e63946', 18) })
            .bindPopup(`<strong>${seg.depart}</strong><br>🚉 Départ`)
            .addTo(markersLayer);
        }
      }

      if (arriveeCoords) {
        bounds.extend(arriveeCoords);
        routePoints.push(arriveeCoords);

        const isLast = i === parcours.length - 1;
        L.marker(arriveeCoords, {
          icon: createStationIcon(isLast ? '#10b981' : '#f59e0b', isLast ? 16 : 14)
        })
          .bindPopup(`<strong>${seg.arrivee}</strong><br>📍 Étape ${i + 1}`)
          .addTo(markersLayer);
      }
    });

    if (routePoints.length > 1) {
      L.polyline(routePoints, {
        color: '#e63946',
        weight: 3.5,
        opacity: 0.85
      }).addTo(routeLayer);
    }

    if (availableDestinations && availableDestinations.length) {
      const lastStation = parcours[parcours.length - 1].arrivee;
      const lastCoords = getCoords(lastStation);
      if (lastCoords) {
        availableDestinations.forEach(({ name }) => {
          const coords = getCoords(name);
          if (!coords) return;
          bounds.extend(coords);

          L.polyline([lastCoords, coords], {
            color: '#6366f1',
            weight: 1.5,
            opacity: 0.2,
            dashArray: '4 4'
          }).addTo(routeLayer);

          L.marker(coords, { icon: createStationIcon('#6366f1', 10) })
            .bindPopup(`<strong>${name}</strong>`)
            .addTo(markersLayer);
        });
      }
    }

    map.fitBounds(bounds.pad(0.15));
  }

  function invalidateSize() {
    if (map) setTimeout(() => map.invalidateSize(), 100);
  }

  function destroyMap() {
    if (map) {
      map.remove();
      map = null;
      markersLayer = null;
      routeLayer = null;
      originMarker = null;
    }
  }

  window.TrainMap = {
    initMap,
    loadAllStationCoords,
    showDestinations,
    showItinerary,
    invalidateSize,
    destroyMap,
    getCoords
  };
})();

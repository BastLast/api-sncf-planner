// Entrée principale (global) + datalist dynamique

(function(){
  const { fetchTrains, fetchStations } = window.Api;
  const { parseDateTime, formatDate, formatDateTime, normalizeStationForApi } = window.Utils;
  const { renderTrainItem, renderItinerarySegments, showLoading, showError, showResultsHeader, renderResetButton } = window.UI;

  const form = document.getElementById('searchForm');
  const resultsDiv = document.getElementById('results');
  const stationInput = document.getElementById('city');
  const stationsDatalist = document.getElementById('stations');

  // Suppression de la fonction hydrateStations dupliquée - utilisation de la version simplifiée plus bas

  // Liste hardcodée des gares SNCF
  const allStations = [
    'PARIS (intramuros)',
    'LYON (intramuros)',
    'BORDEAUX ST JEAN',
    'MARSEILLE ST CHARLES',
    'VALENCE TGV',
    'AVIGNON TGV',
    'STRASBOURG',
    'AEROPORT ROISSY CDG 2 TGV',
    'MARNE LA VALLEE CHESSY',
    'AIX EN PROVENCE TGV',
    'NANTES',
    'NIMES CENTRE',
    'MONTPELLIER SAINT ROCH',
    'RENNES',
    'ST PIERRE DES CORPS',
    'LILLE (intramuros)',
    'TOULOUSE MATABIAU',
    'BEZIERS',
    'NARBONNE',
    'ANGERS SAINT LAUD',
    'MASSY TGV',
    'MEUSE TGV',
    'LE MANS',
    'DIJON VILLE',
    'MULHOUSE VILLE',
    'BELFORT MONTBELIARD TGV',
    'BESANCON FRANCHE COMTE TGV',
    'TOULON',
    'MONTAUBAN VILLE BOURBON',
    'POITIERS',
    'NICE VILLE',
    'ANTIBES',
    'CANNES',
    'SETE',
    'VIERZON',
    'CARCASSONNE',
    'ST RAPHAEL VALESCURE',
    'LA ROCHELLE VILLE',
    'PERPIGNAN',
    'CHAMPAGNE ARDENNE TGV',
    'LAVAL',
    'MONTPELLIER SUD DE FRANCE',
    'AGEN',
    'TGV HAUTE PICARDIE',
    'LORRAINE TGV',
    'BAYONNE',
    'ANGOULEME',
    'NIMES PONT DU GARD',
    'BRIVE LA GAILLARDE',
    'LES AUBRAIS ORLEANS',
    'MOULINS SUR ALLIER',
    'NEVERS',
    'LIMOGES BENEDICTINS',
    'DAX',
    'CHATEAUROUX',
    'COLMAR',
    'LA SOUTERRAINE',
    'AGDE',
    'BRUXELLES MIDI',
    'LYON ST EXUPERY TGV.',
    'VANNES',
    'LES ARCS DRAGUIGNAN',
    'LORIENT',
    'QUIMPER',
    'CLERMONT FERRAND',
    'METZ VILLE',
    'ST BRIEUC',
    'SAUMUR',
    'AURAY',
    'LOURDES',
    'PAU',
    'TARBES',
    'NANCY',
    'BREST',
    'HENDAYE',
    'ST JEAN DE LUZ CIBOURE',
    'BIARRITZ',
    'MACON VILLE',
    'GUINGAMP',
    'ORTHEZ',
    'MORLAIX',
    'KARLSRUHE HBF',
    'CHALON SUR SAONE',
    'CAHORS',
    'ARRAS',
    'GOURDON',
    'SOUILLAC',
    'LA ROCHE SUR YON',
    'FRANKFURT AM MAIN HBF',
    'MANNHEIM HBF',
    'CHAMBERY CHALLES LES EAUX',
    'ROCHEFORT',
    'VENDOME VILLIERS SUR LOIR',
    'MACON LOCHE TGV',
    'SURGERES',
    'VICHY',
    'RIOM CHATEL GUYON',
    'SAINT GERMAIN DES FOSSES',
    'ST NAZAIRE',
    'ARLES',
    'BEAUNE',
    'BOURGES',
    'ROANNE'
  ];
  
  // Fonction simplifiée qui utilise la liste hardcodée
  function loadAndStoreStations() {
    updateStationsList(allStations);
    console.log(`${allStations.length} gares chargées depuis la liste hardcodée`);
  }
  
  // Mettre à jour la liste des gares affichées
  function updateStationsList(stations) {
    stationsDatalist.innerHTML = '';
    stations.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      stationsDatalist.appendChild(opt);
    });
  }
  
  // Filtrer les gares en temps réel pendant la saisie
  stationInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (!query || query.length < 2) {
      updateStationsList(allStations);
      return;
    }
    
    const filtered = allStations.filter(station => 
      station.toLowerCase().includes(query)
    ).slice(0, 20); // Limiter à 20 résultats pour les performances
    
    updateStationsList(filtered);
  });

  // Fonction d'initialisation des gares (optimisée)
  function hydrateStations() {
    stationInput.placeholder = "Chargement des gares...";
    stationInput.disabled = true;
    
    // Utiliser la liste hardcodée (performance améliorée)
    setTimeout(() => {
      loadAndStoreStations();
      stationInput.placeholder = "Tapez une gare (auto-complétion)…";
      stationInput.disabled = false;
    }, 100);
  }

  // Initialisation au chargement de la page
  window.addEventListener('DOMContentLoaded', hydrateStations);

  // Validation et traitement du formulaire
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const rawCity = stationInput.value.trim();
    const selectedDate = document.getElementById('date').value;
    
    // Validation des entrées
    if (!rawCity) {
      showError(resultsDiv, 'Veuillez saisir une gare de départ.');
      return;
    }
    
    if (!selectedDate) {
      showError(resultsDiv, 'Veuillez sélectionner une date.');
      return;
    }
    
    // Vérifier que la date n'est pas dans le passé
    const dateObj = new Date(selectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dateObj < today) {
      showError(resultsDiv, 'Veuillez sélectionner une date égale ou ultérieure à aujourd\'hui.');
      return;
    }
    
    const city = normalizeStationForApi(rawCity);
    showLoading(resultsDiv, 'Chargement des trains…');
    form.style.display = 'none';

    try {
      const trains = await fetchTrains({ date: selectedDate, origin: city });
      if (!trains.length) {
        resultsDiv.innerHTML = '<p>Aucun train trouvé pour cette gare à cette date (TGVmax/Happy Card).</p>';
        form.style.display = '';
        return;
      }
      showResultsHeader(resultsDiv, city, formatDate(selectedDate));
      trains.forEach((t) => {
        const item = renderTrainItem(t);
        item.addEventListener('click', () => showItinerary(city, selectedDate, t, []));
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
      hydrateStations();
    });
    resultsDiv.appendChild(reset);
  }

  // Exposer pour debug manuel si besoin
  window.showItinerary = showItinerary;
})();

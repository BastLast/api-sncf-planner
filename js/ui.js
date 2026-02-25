// Fonctions de rendu UI (global window.UI)
(function(){
  const { formatDateTime, calculateDuration, calculateSegmentDuration, getNextDates, formatDate, countNights } = window.Utils;
  // NOTE: Ce module construit des éléments (DOM nodes) sauf renderItinerarySegments qui retourne une string HTML (à harmoniser plus tard si besoin).

  function renderResetButton(onClick) {
    const btn = document.createElement('button');
    btn.id = 'resetBtn';
    btn.textContent = 'Réinitialiser l’itinéraire';
    btn.className = 'btn-danger';
    btn.onclick = onClick;
    return btn;
  }

  function renderDateChangeButtons(currentDate, station, onDateChange) {
    const container = document.createElement('div');
    container.className = 'date-change-section';
    
    const title = document.createElement('h4');
    title.textContent = 'Aucun train disponible ? Essayez un autre jour :';
    title.className = 'date-change-title';
    container.appendChild(title);
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'date-change-buttons';
    
    const nextDates = getNextDates(currentDate, 3);
    nextDates.forEach(({ date, label }) => {
      const btn = document.createElement('button');
      btn.className = 'btn-date-change';
      btn.textContent = label;
      btn.onclick = () => onDateChange(date);
      buttonsContainer.appendChild(btn);
    });
    
    container.appendChild(buttonsContainer);
    return container;
  }

  // Liste des emojis par gare
  const stationsWithEmoji = {
    'PARIS (intramuros)': '🗼',
    'LYON (intramuros)': '🦁',
    'BORDEAUX ST JEAN': '🍷',
    'MARSEILLE ST CHARLES': '⚓',
    'VALENCE TGV': '🍊',
    'AVIGNON TGV': '🎭',
    'STRASBOURG': '🏰',
    'AEROPORT ROISSY CDG 2 TGV': '✈️',
    'MARNE LA VALLEE CHESSY': '🎢',
    'AIX EN PROVENCE TGV': '🌸',
    'NANTES': '🦆',
    'NIMES CENTRE': '🏛️',
    'MONTPELLIER SAINT ROCH': '🌞',
    'RENNES': '🐓',
    'ST PIERRE DES CORPS': '🚂',
    'LILLE (intramuros)': '🌼',
    'TOULOUSE MATABIAU': '🛩️',
    'BEZIERS': '🍇',
    'NARBONNE': '🏖️',
    'ANGERS SAINT LAUD': '🌹',
    'MASSY TGV': '🏙️',
    'MEUSE TGV': '🌾',
    'LE MANS': '🏎️',
    'DIJON VILLE': '🥒',
    'MULHOUSE VILLE': '🚗',
    'BELFORT MONTBELIARD TGV': '🪖',
    'BESANCON FRANCHE COMTE TGV': '⏱️',
    'TOULON': '⛴️',
    'MONTAUBAN VILLE BOURBON': '🎨',
    'POITIERS': '🤖',
    'NICE VILLE': '🌴',
    'ANTIBES': '⛵',
    'CANNES': '🎬',
    'SETE': '🐟',
    'VIERZON': '🚜',
    'CARCASSONNE': '🛡️',
    'ST RAPHAEL VALESCURE': '🏝️',
    'LA ROCHELLE VILLE': '🦪',
    'PERPIGNAN': '🌶️',
    'CHAMPAGNE ARDENNE TGV': '🍾',
    'LAVAL': '🐄',
    'MONTPELLIER SUD DE FRANCE': '🌻',
    'AGEN': '🍑',
    'TGV HAUTE PICARDIE': '🌬️',
    'LORRAINE TGV': '🥧',
    'BAYONNE': '🍫',
    'ANGOULEME': '📚',
    'NIMES PONT DU GARD': '🌉',
    'BRIVE LA GAILLARDE': '🍯',
    'LES AUBRAIS ORLEANS': '🏹',
    'MOULINS SUR ALLIER': '🩰',
    'NEVERS': '🏁',
    'LIMOGES BENEDICTINS': '🍽️',
    'DAX': '♨️',
    'CHATEAUROUX': '🏯',
    'COLMAR': '🌺',
    'LA SOUTERRAINE': '⛏️',
    'AGDE': '🏊',
    'BRUXELLES MIDI': '🧇',
    'LYON ST EXUPERY TGV.': '🛫',
    'VANNES': '🦀',
    'LES ARCS DRAGUIGNAN': '🏔️',
    'LORIENT': '🛶',
    'QUIMPER': '🖌️',
    'CLERMONT FERRAND': '🌋',
    'METZ VILLE': '🌳',
    'ST BRIEUC': '🐚',
    'SAUMUR': '🥂',
    'AURAY': '🚤',
    'LOURDES': '⛪',
    'PAU': '🏇',
    'TARBES': '⛷️',
    'NANCY': '💮',
    'BREST': '🚢',
    'HENDAYE': '🏄',
    'ST JEAN DE LUZ CIBOURE': '🦞',
    'BIARRITZ': '🌊',
    'MACON VILLE': '🥨',
    'GUINGAMP': '⚽',
    'ORTHEZ': '🥖',
    'MORLAIX': '🌁',
    'KARLSRUHE HBF': '🇩🇪',
    'CHALON SUR SAONE': '🍎',
    'CAHORS': '🍒',
    'ARRAS': '💐',
    'GOURDON': '🥦',
    'SOUILLAC': '🥐',
    'LA ROCHE SUR YON': '🐴',
    'FRANKFURT AM MAIN HBF': '🍺',
    'MANNHEIM HBF': '🎼',
    'CHAMBERY CHALLES LES EAUX': '⛰️',
    'ROCHEFORT': '🪝',
    'VENDOME VILLIERS SUR LOIR': '🏞️',
    'MACON LOCHE TGV': '🧀',
    'SURGERES': '🧈',
    'VICHY': '💧',
    'RIOM CHATEL GUYON': '🪨',
    'SAINT GERMAIN DES FOSSES': '🚉',
    'ST NAZAIRE': '🛳️',
    'ARLES': '🐂',
    'BEAUNE': '🍄',
    'BOURGES': '🎻',
    'ROANNE': '🥩'
  };

  function stationWithEmoji(name) {
    return stationsWithEmoji[name] ? `${name} ${stationsWithEmoji[name]}` : name;
  }

  function renderTrainItem(train) {
    const div = document.createElement('div');
    div.className = 'train card';
    const numero = train.train_no ? `Train ${train.train_no}` : 'Train';
    const heure = train.heure_depart || '?';
    const dest = train.destination || '?';
    const arr = train.heure_arrivee ? ` (arrivée ${train.heure_arrivee})` : '';
    
    // Calculer la durée si les deux heures sont disponibles
    const duration = calculateDuration(train.heure_depart, train.heure_arrivee);
    const durationText = duration ? ` • ${duration}` : '';
    
    div.innerHTML = `
      <div class="card-header">
        <div class="card-header-main">
          <span class="badge">${heure}</span>
          <strong>${numero}</strong>
        </div>
        ${duration ? `<span class="duration-badge">${duration}</span>` : ''}
      </div>
      <div class="card-body">
        <span class="to">→ ${stationWithEmoji(dest)}${arr}</span>
      </div>`;
    div.style.cursor = 'pointer';
    return div;
  }

  function renderItinerarySegments(segments, onRemoveLastStep = null) {
    // Retourne un élément DOM complet (div)
    const container = document.createElement('div');
    container.className = 'itinerary-wrapper';
    const title = document.createElement('h2');
    title.textContent = 'Itinéraire';
    container.appendChild(title);

    segments.forEach((seg, i) => {
      const card = document.createElement('div');
      card.className = 'itineraire-segment card subtle';

      const header = document.createElement('div');
      header.className = 'segment-header';
      header.innerHTML = `<strong>Étape ${i + 1}</strong>`;
      card.appendChild(header);

      const pDepart = document.createElement('p');
      pDepart.textContent = `Départ : ${stationWithEmoji(seg.depart)} le ${formatDateTime(seg.departDateTime)}`;
      card.appendChild(pDepart);

      const pTrain = document.createElement('p');
      pTrain.textContent = `Train : ${seg.train.numero || '—'} vers ${stationWithEmoji(seg.train.destination || '—')} (départ ${seg.train.heure || '—'})`;
      card.appendChild(pTrain);

      const pArrivee = document.createElement('p');
      pArrivee.textContent = `Arrivée : ${stationWithEmoji(seg.arrivee)} le ${formatDateTime(seg.arriveeDateTime)}`;
      card.appendChild(pArrivee);

      const segmentDuration = calculateSegmentDuration(seg.departDateTime, seg.arriveeDateTime);
      if (segmentDuration) {
        const pDur = document.createElement('p');
        pDur.className = 'segment-duration';
        pDur.innerHTML = `Durée du trajet : <span class="duration-highlight">${segmentDuration}</span>`;
        card.appendChild(pDur);
      }

      if (i < segments.length - 1) {
        const nextSeg = segments[i + 1];
        const waitTime = calculateSegmentDuration(seg.arriveeDateTime, nextSeg.departDateTime);
        if (waitTime) {
          const pWait = document.createElement('p');
            pWait.className = 'wait-time';
            pWait.innerHTML = `Temps d'attente : <span class="wait-highlight">${waitTime}</span>`;
            card.appendChild(pWait);
        }

        // Night detection: show overnight stays between segments
        const nights = countNights(seg.arriveeDateTime, nextSeg.departDateTime);
        if (nights > 0) {
          const nightDiv = document.createElement('div');
          nightDiv.className = 'night-indicator';
          const nightLabel = nights === 1 ? 'nuit' : 'nuits';
          nightDiv.innerHTML = `<span class="night-icon">🌙</span> <strong>${nights} ${nightLabel}</strong> à ${stationWithEmoji(seg.arrivee)}`;
          card.appendChild(nightDiv);
        }
      }

      container.appendChild(card);
    });

    if (segments.length > 0) {
      const totalDuration = calculateSegmentDuration(segments[0].departDateTime, segments[segments.length - 1].arriveeDateTime);
      if (totalDuration) {
        const totalDiv = document.createElement('div');
        totalDiv.className = 'total-duration card highlight';
        totalDiv.innerHTML = `<strong>Durée totale du voyage : ${totalDuration}</strong>`;
        container.appendChild(totalDiv);
      }
    }

    if (segments.length > 1 && onRemoveLastStep) {
      const actions = document.createElement('div');
      actions.className = 'itinerary-actions';
      const btn = document.createElement('button');
      btn.id = 'removeLastStepBtn';
      btn.className = 'btn-secondary';
      btn.type = 'button';
      btn.textContent = 'Supprimer la dernière étape';
      btn.addEventListener('click', onRemoveLastStep);
      actions.appendChild(btn);
      container.appendChild(actions);
    }
    return container;
  }

  // Helper pour créer l'élément + header des trains disponibles
  function createItineraryElement(segments, onRemoveLastStep, nextStation, afterDateTime) {
    const wrapper = document.createElement('div');
    wrapper.className = 'itinerary-block';
    const itinEl = renderItinerarySegments(segments, onRemoveLastStep);
    wrapper.appendChild(itinEl);
    if (nextStation) {
      const h3 = document.createElement('h3');
      h3.textContent = `Trains disponibles depuis ${stationWithEmoji(nextStation)} après ${formatDateTime(afterDateTime)}`;
      h3.id = 'available-trains-title';
      wrapper.appendChild(h3);
    }
    const listContainer = document.createElement('div');
    listContainer.id = 'availableTrains';
    listContainer.setAttribute('role', 'region');
    listContainer.setAttribute('aria-labelledby', 'available-trains-title');
    wrapper.appendChild(listContainer);
    return { wrapper, listContainer };
  }

  function showLoading(container, text = 'Chargement…') {
    container.innerHTML = `<div class="loader"><div class="spinner"></div><span>${text}</span></div>`;
  }

  function showError(container, message) {
    container.innerHTML = `<p class="error">${message}</p>`;
  }

  function showResultsHeader(container, origin, dateText) {
  container.innerHTML = `<h2>Trains au départ de ${stationWithEmoji(origin)} le ${dateText}</h2>`;
  }

  // Fonction pour afficher les trains groupés par destination avec menu latéral
  function renderGroupedTrainsView(origin, dateText, trainsByDestination, onTrainClick) {
    const mainContainer = document.createElement('div');
    mainContainer.className = 'grouped-trains-container';

    // Header principal
    const header = document.createElement('div');
    header.className = 'grouped-header';
    header.innerHTML = `<h2>Trains au départ de ${stationWithEmoji(origin)} le ${dateText}</h2>`;
    mainContainer.appendChild(header);

    // Container principal avec sidebar et contenu
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';

    // Menu latéral avec liste des destinations
    const sidebar = document.createElement('div');
    sidebar.className = 'destinations-sidebar';
    
    const sidebarTitle = document.createElement('h3');
    sidebarTitle.textContent = 'Destinations disponibles';
    sidebarTitle.className = 'sidebar-title';
    sidebar.appendChild(sidebarTitle);

    const destinationsList = document.createElement('ul');
    destinationsList.className = 'destinations-list';

    // Zone de contenu principal
    const mainContent = document.createElement('div');
    mainContent.className = 'trains-content';

    // Créer les sections pour chaque destination
    const destinations = Object.keys(trainsByDestination).sort();
    
    destinations.forEach((destination, index) => {
      const trains = trainsByDestination[destination];
      
      // Créer l'élément de menu latéral
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#destination-${index}`;
      link.className = 'destination-link';
      link.innerHTML = `
        <span class="destination-name">${stationWithEmoji(destination)}</span>
        <span class="train-count">${trains.length} train${trains.length > 1 ? 's' : ''}</span>
      `;
      
      // Scroll vers la section correspondante
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSection = document.getElementById(`destination-${index}`);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          // Mise à jour de l'état actif
          document.querySelectorAll('.destination-link').forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
      
      listItem.appendChild(link);
      destinationsList.appendChild(listItem);

      // Créer la section de contenu pour cette destination
      const section = document.createElement('div');
      section.className = 'destination-section';
      section.id = `destination-${index}`;

      const sectionHeader = document.createElement('h3');
      sectionHeader.className = 'destination-header';
      sectionHeader.innerHTML = `
        <span class="destination-title">${stationWithEmoji(destination)}</span>
        <span class="train-count-header">${trains.length} train${trains.length > 1 ? 's' : ''}</span>
      `;
      section.appendChild(sectionHeader);

      const trainsGrid = document.createElement('div');
      trainsGrid.className = 'trains-grid';

      // Ajouter les trains de cette destination
      trains.forEach(train => {
        const trainElement = renderTrainItem(train);
        trainElement.addEventListener('click', () => onTrainClick(train, destination));
        trainsGrid.appendChild(trainElement);
      });

      section.appendChild(trainsGrid);
      mainContent.appendChild(section);
    });

    // Activer le premier élément par défaut
    const firstLink = destinationsList.querySelector('.destination-link');
    if (firstLink) {
      firstLink.classList.add('active');
    }

    sidebar.appendChild(destinationsList);
    contentWrapper.appendChild(sidebar);
    contentWrapper.appendChild(mainContent);
    mainContainer.appendChild(contentWrapper);

    return mainContainer;
  }

  // Fonction pour rendre un sélecteur de ville avec autocomplétion
  function renderCitySelector(allStations, onCitySelect, currentStation) {
    const container = document.createElement('div');
    container.className = 'city-selector-section';
    
    const title = document.createElement('h4');
    title.textContent = 'Ou choisissez une autre ville de correspondance :';
    title.className = 'city-selector-title';
    container.appendChild(title);
    
    const inputContainer = document.createElement('div');
    inputContainer.className = 'city-input-container';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'city-selector-input';
    input.name = 'city-selector';
    input.className = 'city-selector-input';
    input.placeholder = 'Tapez une ville...';
    input.setAttribute('list', 'city-selector-datalist');
    input.setAttribute('autocomplete', 'off');
    
    const datalist = document.createElement('datalist');
    datalist.id = 'city-selector-datalist';
    
    // Filtrer pour exclure la gare actuelle et ajouter toutes les autres
    const filteredStations = allStations.filter(station => station !== currentStation);
    
    // Fonction pour mettre à jour la datalist
    function updateDatalist(stations) {
      datalist.innerHTML = '';
      stations.forEach(station => {
        const option = document.createElement('option');
        option.value = station;
        datalist.appendChild(option);
      });
    }
    
    // Initialiser avec toutes les stations
    updateDatalist(filteredStations);
    
    // Filtrage en temps réel
    input.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      if (!query || query.length < 2) {
        updateDatalist(filteredStations);
        return;
      }
      
      const filtered = filteredStations.filter(station => 
        station.toLowerCase().includes(query)
      ).slice(0, 20); // Limiter à 20 résultats
      
      updateDatalist(filtered);
    });
    
    const selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.className = 'btn-primary city-select-btn';
    selectButton.textContent = 'Choisir cette ville';
    selectButton.disabled = true;
    
    // Activer/désactiver le bouton selon la saisie
    input.addEventListener('input', () => {
      const value = input.value.trim();
      selectButton.disabled = !value || !filteredStations.includes(value);
    });
    
    // Gérer la sélection
    selectButton.addEventListener('click', () => {
      const selectedCity = input.value.trim();
      if (selectedCity && filteredStations.includes(selectedCity)) {
        onCitySelect(selectedCity);
      }
    });
    
    // Permettre la sélection avec Entrée
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const selectedCity = input.value.trim();
        if (selectedCity && filteredStations.includes(selectedCity)) {
          onCitySelect(selectedCity);
        }
      }
    });
    
    inputContainer.appendChild(input);
    inputContainer.appendChild(datalist);
    inputContainer.appendChild(selectButton);
    container.appendChild(inputContainer);
    
    return container;
  }

  // Export unique
  window.UI = { 
    renderTrainItem, 
    renderItinerarySegments, 
    createItineraryElement,
    showLoading, 
    showError, 
    showResultsHeader, 
    renderResetButton,
    renderDateChangeButtons,
    renderGroupedTrainsView,
    renderCitySelector
  };
})();

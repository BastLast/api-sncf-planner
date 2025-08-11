// Fonctions de rendu UI (global window.UI)
(function(){
  const { formatDateTime, calculateDuration, calculateSegmentDuration, getNextDates, formatDate } = window.Utils;
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

  // Export unique
  window.UI = { 
    renderTrainItem, 
    renderItinerarySegments, 
    createItineraryElement,
    showLoading, 
    showError, 
    showResultsHeader, 
    renderResetButton,
    renderDateChangeButtons
  };
})();

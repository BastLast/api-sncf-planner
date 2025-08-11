// Fonctions de rendu UI (global window.UI)
(function(){
  const { formatDateTime, calculateDuration } = window.Utils;

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

  function renderItinerarySegments(segments) {
    let html = '<h2>Itinéraire</h2>';
    segments.forEach((seg, i) => {
      html += `<div class="itineraire-segment card subtle">
        <p><strong>Étape ${i + 1}</strong></p>
        <p>Départ : ${stationWithEmoji(seg.depart)} le ${formatDateTime(seg.departDateTime)}</p>
        <p>Train : ${seg.train.numero || '—'} vers ${stationWithEmoji(seg.train.destination || '—')} (départ ${seg.train.heure || '—'})</p>
        <p>Arrivée : ${stationWithEmoji(seg.arrivee)} le ${formatDateTime(seg.arriveeDateTime)}</p>
      </div>`;
    });
    return html;
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

  function renderResetButton(onClick) {
    const btn = document.createElement('button');
    btn.id = 'resetBtn';
    btn.textContent = 'Réinitialiser l’itinéraire';
    btn.className = 'btn-danger';
    btn.onclick = onClick;
    return btn;
  }

  window.UI = { renderTrainItem, renderItinerarySegments, showLoading, showError, showResultsHeader, renderResetButton };
})();

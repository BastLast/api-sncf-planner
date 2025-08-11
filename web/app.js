
const fakeTrains = {
    'Paris': [
        { heure: '08:15', destination: 'Lyon', numero: 'TGV 8412', duree: 120 },
        { heure: '09:30', destination: 'Marseille', numero: 'TGV 6120', duree: 220 }
    ],
    'Lyon': [
        { heure: '10:00', destination: 'Paris', numero: 'TGV 8413', duree: 120 },
        { heure: '11:45', destination: 'Lille', numero: 'TGV 9802', duree: 180 }
    ],
    'Marseille': [
        { heure: '12:20', destination: 'Bordeaux', numero: 'TGV 4510', duree: 210 },
        { heure: '13:50', destination: 'Paris', numero: 'TGV 6121', duree: 220 }
    ],
    'Bordeaux': [
        { heure: '14:10', destination: 'Lyon', numero: 'TGV 8414', duree: 180 },
        { heure: '15:30', destination: 'Marseille', numero: 'TGV 4511', duree: 210 }
    ],
    'Lille': [
        { heure: '16:00', destination: 'Paris', numero: 'TGV 9803', duree: 120 },
        { heure: '17:25', destination: 'Lyon', numero: 'TGV 8415', duree: 180 }
    ]
};

function parseDateTime(dateStr, timeStr) {
    // dateStr: '2025-08-11', timeStr: '08:15'
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute);
}

function formatDateTime(dt) {
    return dt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

document.getElementById('searchForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const city = document.getElementById('city').value;
    const date = document.getElementById('date').value;
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    document.getElementById('searchForm').style.display = 'none';

    const trains = fakeTrains[city] || [];
    if (trains.length === 0) {
        resultsDiv.innerHTML = '<p>Aucun train trouvé pour cette gare.</p>';
        document.getElementById('searchForm').style.display = '';
        return;
    }
    resultsDiv.innerHTML = `<h2>Trains au départ de ${city} le ${date}</h2>`;
    trains.forEach((train, idx) => {
        const trainDiv = document.createElement('div');
        trainDiv.className = 'train';
        trainDiv.innerHTML = `<strong>${train.numero}</strong> - Départ à ${train.heure} vers ${train.destination}`;
        trainDiv.style.cursor = 'pointer';
        trainDiv.addEventListener('click', function() {
            showItineraire(city, date, train);
        });
        resultsDiv.appendChild(trainDiv);
    });
});


function showItineraire(departVille, departDate, train, parcours = []) {
    const resultsDiv = document.getElementById('results');
    // Calculer l'heure d'arrivée
    const departDateTime = parseDateTime(departDate, train.heure);
    const arriveeDateTime = new Date(departDateTime.getTime() + train.duree * 60000);

    // Ajouter ce segment au parcours
    const nouveauParcours = [...parcours, {
        depart: departVille,
        departDateTime,
        train,
        arrivee: train.destination,
        arriveeDateTime
    }];

    // Affichage du parcours complet
    let parcoursHtml = '<h2>Itinéraire</h2>';
    nouveauParcours.forEach((seg, i) => {
        parcoursHtml += `<div class="itineraire-segment">
            <p><strong>Étape ${i+1} :</strong></p>
            <p>Départ : ${seg.depart} le ${formatDateTime(seg.departDateTime)}</p>
            <p>Train : ${seg.train.numero} vers ${seg.train.destination} (départ ${seg.train.heure})</p>
            <p>Arrivée : ${seg.arrivee} le ${formatDateTime(seg.arriveeDateTime)}</p>
        </div>`;
    });

    let html = parcoursHtml + `<h3>Trains disponibles depuis ${train.destination} après ${formatDateTime(arriveeDateTime)}</h3>`;

    // Chercher les trains depuis la ville d'arrivée, après l'heure d'arrivée
    const nextTrains = (fakeTrains[train.destination] || []).filter(t => {
        // On suppose que la date est la même, on compare l'heure
        const tDateTime = parseDateTime(departDate, t.heure);
        return tDateTime > arriveeDateTime;
    });
    if (nextTrains.length === 0) {
        html += '<p>Aucun train disponible après cette heure.</p>';
    } else {
        nextTrains.forEach(t => {
            const tDiv = document.createElement('div');
            tDiv.className = 'train';
            tDiv.innerHTML = `<strong>${t.numero}</strong> - Départ à ${t.heure} vers ${t.destination}`;
            tDiv.style.cursor = 'pointer';
            tDiv.addEventListener('click', function() {
                // On poursuit l'itinéraire
                showItineraire(train.destination, departDate, t, nouveauParcours);
            });
            // On ajoute dynamiquement après le rendu principal
            setTimeout(() => resultsDiv.appendChild(tDiv), 0);
        });
    }

    // Ajout du bouton de réinitialisation toujours visible
    html += `<button id="resetBtn" style="margin:20px 0;padding:10px 18px;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:16px;">Réinitialiser l’itinéraire</button>`;

    resultsDiv.innerHTML = html;

    document.getElementById('resetBtn').onclick = function() {
        resultsDiv.innerHTML = '';
        document.getElementById('searchForm').reset();
        document.getElementById('searchForm').style.display = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
}

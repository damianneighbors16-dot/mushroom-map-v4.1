const species = {
  russula: { name: 'Russula', subtitle: 'brittlegill', icon: '🍄', ideal: { rain: 38, elevation: 1250, seasons: ['summer', 'fall'] }, signals: ['Mixed woodland context', 'Moisture setting is within range', 'Season can support fruiting'] },
  hawksWing: { name: "Hawk’s wing", subtitle: 'Sarcodon imbricatus', icon: '🪶', ideal: { rain: 48, elevation: 1880, seasons: ['summer', 'fall'] }, signals: ['Higher-elevation terrain signal', 'Cooler mountain conditions can help', 'Seasonal window is favorable'] },
  chanterelle: { name: 'Chanterelle', subtitle: 'Cantharellus', icon: '🌼', ideal: { rain: 55, elevation: 900, seasons: ['summer', 'fall'] }, signals: ['Moist forest conditions', 'Rain setting supports fruiting', 'Season can support fruiting'] },
  morel: { name: 'Morel', subtitle: 'Morchella', icon: '◖◗', ideal: { rain: 26, elevation: 700, seasons: ['spring'] }, signals: ['Spring timing is important', 'Moderate moisture signal', 'Terrain is only one factor'] }
};

let selectedKey = 'russula';
let marker;
let selectedLatLng;
let map;
let elevationRequest = 0;

const grid = document.getElementById('speciesGrid');
const mapStatus = document.getElementById('mapStatus');
const emptyState = document.getElementById('emptyState');
const results = document.getElementById('resultContent');
const rain = document.getElementById('rainRange');
const elevation = document.getElementById('elevationRange');
const season = document.getElementById('seasonSelect');
const toast = document.getElementById('toast');
const mapHint = document.getElementById('mapHint');

function renderSpecies() {
  grid.innerHTML = Object.entries(species).map(([key, item]) => `
    <button class="species-card ${key === selectedKey ? 'selected' : ''}" role="radio" aria-checked="${key === selectedKey}" data-species="${key}">
      <span class="species-icon">${item.icon}</span><strong>${item.name}</strong><small>${item.subtitle}</small>
    </button>`).join('');
  grid.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    selectedKey = button.dataset.species;
    renderSpecies();
    if (selectedLatLng) updateResult();
  }));
}

function calculateScore() {
  const item = species[selectedKey];
  const rainGap = Math.abs(Number(rain.value) - item.ideal.rain);
  const elevationGap = Math.abs(Number(elevation.value) - item.ideal.elevation) / 24;
  const seasonBonus = item.ideal.seasons.includes(season.value) ? 15 : -13;
  const geographicVariation = selectedLatLng ? Math.round((Math.abs(selectedLatLng.lat * 11 + selectedLatLng.lng * 3) % 16) - 8) : 0;
  return Math.max(12, Math.min(94, Math.round(78 - rainGap * .72 - elevationGap + seasonBonus + geographicVariation)));
}

function updateResult() {
  const item = species[selectedKey];
  const score = calculateScore();
  const label = score >= 75 ? 'Promising' : score >= 52 ? 'Possible' : 'Less likely';
  const seasonText = item.ideal.seasons.includes(season.value) ? 'Season matches this species’ usual fruiting window.' : 'Season is outside this species’ strongest fruiting window.';
  document.getElementById('scoreSpecies').textContent = `${item.name} habitat`;
  document.getElementById('scoreLabel').textContent = label;
  document.getElementById('scoreValue').textContent = score;
  document.getElementById('scoreRing').style.borderRightColor = score >= 75 ? '#214e3e' : score >= 52 ? '#d28a36' : '#b85c3f';
  document.getElementById('resultSummary').textContent = score >= 75 ? `This place has several conditions that could support ${item.name} habitat. Treat it as a lead to investigate, not a sighting.` : score >= 52 ? `There are a few useful signals at this location, but the conditions are mixed for ${item.name}.` : `The current location and conditions do not strongly match typical ${item.name} habitat.`;
  const signals = [...item.signals];
  signals.push(`Live elevation: ${Number(elevation.value).toLocaleString()} m`);
  document.getElementById('signalList').innerHTML = signals.slice(0, 3).map((signal, index) => `<li class="${index === 2 && score < 52 ? 'negative' : ''}">${signal}</li>`).join('');
}

function revealResult(latlng) {
  selectedLatLng = latlng;
  if (marker) marker.setLatLng(latlng); else marker = L.circleMarker(latlng, { radius: 10, color: '#fff', weight: 3, fillColor: '#b85c3f', fillOpacity: 1 }).addTo(map);
  mapHint.classList.add('is-hidden');
  emptyState.classList.add('is-hidden');
  results.classList.remove('is-hidden');
  mapStatus.textContent = `Pin placed · ${latlng.lat.toFixed(4)}°, ${latlng.lng.toFixed(4)}°`;
  updateResult();
  lookupElevation(latlng);
}

async function lookupElevation(latlng) {
  const thisRequest = ++elevationRequest;
  document.getElementById('terrainReadout').classList.remove('is-hidden');
  document.getElementById('elevationReadout').textContent = 'Loading…';
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(latlng.lat)}&longitude=${encodeURIComponent(latlng.lng)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Elevation lookup failed');
    const data = await response.json();
    const meters = Math.round(Number(data.elevation?.[0]));
    if (!Number.isFinite(meters) || thisRequest !== elevationRequest) return;
    elevation.value = Math.max(Number(elevation.min), Math.min(Number(elevation.max), meters));
    document.getElementById('elevationOutput').value = `${meters.toLocaleString()} m`;
    document.getElementById('elevationReadout').textContent = `${meters.toLocaleString()} m`;
    updateResult();
  } catch (error) {
    if (thisRequest !== elevationRequest) return;
    document.getElementById('elevationReadout').textContent = 'Unavailable';
    showToast('Live elevation could not be retrieved.');
  }
}

function updateOutputs() {
  document.getElementById('rainOutput').value = `${rain.value} mm`;
  document.getElementById('elevationOutput').value = `${Number(elevation.value).toLocaleString()} m`;
  if (selectedLatLng) updateResult();
}

function initializeMap() {
  map = L.map('mapCanvas', { zoomControl: false }).setView([39.7392, -104.9903], 9);
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  map.on('click', event => revealResult(event.latlng));
  mapStatus.textContent = 'Click the map to place a pin';
}

document.getElementById('locateButton').addEventListener('click', () => {
  if (!navigator.geolocation) return showToast('This browser does not support location access.');
  mapStatus.textContent = 'Requesting your location…';
  navigator.geolocation.getCurrentPosition(
    position => { const point = L.latLng(position.coords.latitude, position.coords.longitude); map.setView(point, 12); revealResult(point); },
    () => { mapStatus.textContent = 'Location permission was not granted'; showToast('Choose a point on the map instead.'); },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
});

document.getElementById('resetButton').addEventListener('click', () => {
  selectedKey = 'russula'; rain.value = 34; elevation.value = 1460; season.value = 'summer'; selectedLatLng = null;
  if (marker) { map.removeLayer(marker); marker = null; }
  mapHint.classList.remove('is-hidden'); emptyState.classList.remove('is-hidden'); results.classList.add('is-hidden');
  document.getElementById('terrainReadout').classList.add('is-hidden'); mapStatus.textContent = 'Click the map to place a pin'; renderSpecies(); updateOutputs();
});
document.getElementById('detailsButton').addEventListener('click', () => showToast('Data-source details are the next screen to build.'));
document.getElementById('menuButton').addEventListener('click', () => showToast('Mobile navigation is ready for its next content pass.'));
function showToast(message) { toast.textContent = message; toast.classList.remove('is-hidden'); setTimeout(() => toast.classList.add('is-hidden'), 2500); }

[rain, elevation, season].forEach(control => control.addEventListener('input', updateOutputs));
renderSpecies();
updateOutputs();
initializeMap();

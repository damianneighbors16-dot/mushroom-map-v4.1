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
let contextRequest = 0;
let liveContext = { elevation: null, weather: null, landCover: null };

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
  const signals = [
    liveContext.landCover?.signal || item.signals[0],
    liveContext.weather?.signal || item.signals[1],
    seasonText
  ];
  document.getElementById('signalList').innerHTML = signals.map((signal, index) => `<li class="${index === 2 && score < 52 ? 'negative' : ''}">${signal}</li>`).join('');
}

function revealResult(latlng) {
  selectedLatLng = latlng;
  if (marker) marker.setLatLng(latlng); else marker = L.circleMarker(latlng, { radius: 10, color: '#fff', weight: 3, fillColor: '#b85c3f', fillOpacity: 1 }).addTo(map);
  mapHint.classList.add('is-hidden');
  emptyState.classList.add('is-hidden');
  results.classList.remove('is-hidden');
  mapStatus.textContent = `Pin placed · ${latlng.lat.toFixed(4)}°, ${latlng.lng.toFixed(4)}°`;
  liveContext = { elevation: null, weather: null, landCover: null };
  document.getElementById('weatherReadout').textContent = 'Loading…';
  document.getElementById('rainReadout').textContent = 'Fetching rainfall';
  document.getElementById('landCoverReadout').textContent = 'Loading…';
  document.getElementById('landCoverDetail').textContent = 'Classifying surface';
  updateResult();
  lookupElevation(latlng);
  lookupWeather(latlng);
  lookupLandCover(latlng);
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

async function lookupWeather(latlng) {
  const thisRequest = ++contextRequest;
  try {
    const params = new URLSearchParams({
      latitude: latlng.lat.toFixed(5), longitude: latlng.lng.toFixed(5),
      current: 'temperature_2m,precipitation', hourly: 'precipitation',
      past_days: '1', forecast_days: '1', timezone: 'auto'
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error('Weather lookup failed');
    const data = await response.json();
    if (thisRequest !== contextRequest) return;
    const hours = data.hourly?.time || [];
    const precipitation = data.hourly?.precipitation || [];
    const now = new Date();
    const lastDayRain = hours.reduce((sum, time, index) => {
      const timestamp = new Date(time);
      return timestamp <= now && timestamp >= new Date(now - 24 * 60 * 60 * 1000) ? sum + Number(precipitation[index] || 0) : sum;
    }, 0);
    const temp = Math.round(Number(data.current?.temperature_2m));
    const currentRain = Number(data.current?.precipitation || 0);
    const rainMm = Math.round(lastDayRain * 10) / 10;
    liveContext.weather = { signal: `${rainMm} mm precipitation in the past 24h; live weather data loaded.` };
    rain.value = Math.min(Number(rain.max), Math.round(rainMm));
    document.getElementById('rainOutput').value = `${rainMm} mm`;
    document.getElementById('weatherReadout').textContent = `${temp}°C now`;
    document.getElementById('rainReadout').textContent = `${rainMm} mm / 24h · ${currentRain} mm now`;
    updateResult();
  } catch (error) {
    if (thisRequest !== contextRequest) return;
    document.getElementById('weatherReadout').textContent = 'Unavailable';
    document.getElementById('rainReadout').textContent = 'Weather lookup failed';
  }
}

async function lookupLandCover(latlng) {
  const thisRequest = contextRequest;
  const labels = { 1: 'Water', 2: 'Trees', 4: 'Flooded vegetation', 5: 'Crops', 7: 'Built area', 8: 'Bare ground', 9: 'Snow or ice', 10: 'Clouds', 11: 'Rangeland' };
  try {
    const geometry = JSON.stringify({ x: latlng.lng, y: latlng.lat, spatialReference: { wkid: 4326 } });
    const params = new URLSearchParams({ geometry, geometryType: 'esriGeometryPoint', returnFirstValueOnly: 'true', returnGeometry: 'false', outFields: '*', f: 'json' });
    const response = await fetch(`https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/getSamples?${params}`);
    if (!response.ok) throw new Error('Land-cover lookup failed');
    const data = await response.json();
    if (thisRequest !== contextRequest) return;
    const sample = data.samples?.[0];
    const category = Number(sample?.value);
    const label = labels[category] || 'Unclassified';
    const year = sample?.attributes?.Year;
    liveContext.landCover = { signal: category === 2 ? `Satellite land-cover class: Trees (${year}).` : `Satellite land-cover class: ${label} (${year}).` };
    document.getElementById('landCoverReadout').textContent = label;
    document.getElementById('landCoverDetail').textContent = year ? `Satellite class · ${year}` : 'Satellite class';
    updateResult();
  } catch (error) {
    if (thisRequest !== contextRequest) return;
    document.getElementById('landCoverReadout').textContent = 'Unavailable';
    document.getElementById('landCoverDetail').textContent = 'Land-cover lookup failed';
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
  selectedKey = 'russula'; rain.value = 34; elevation.value = 1460; season.value = 'summer'; selectedLatLng = null; liveContext = { elevation: null, weather: null, landCover: null };
  document.getElementById('weatherReadout').textContent = 'Waiting for pin';
  document.getElementById('rainReadout').textContent = '—';
  document.getElementById('landCoverReadout').textContent = 'Waiting for pin';
  document.getElementById('landCoverDetail').textContent = '—';
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

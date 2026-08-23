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
let liveContext = { elevation: null, weather: null, landCover: null, access: null };
let trackWatchId = null;
let trackLine = null;
let trackPoints = [];
let waypoints = [];
let accessRequest = 0;

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
  document.getElementById('estimatorPin').textContent = `Pin: ${latlng.lat.toFixed(4)}°, ${latlng.lng.toFixed(4)}°`;
  if (marker) marker.setLatLng(latlng); else marker = L.circleMarker(latlng, { radius: 10, color: '#fff', weight: 3, fillColor: '#b85c3f', fillOpacity: 1 }).addTo(map);
  mapHint.classList.add('is-hidden');
  emptyState.classList.add('is-hidden');
  results.classList.remove('is-hidden');
  mapStatus.textContent = `Pin placed · ${latlng.lat.toFixed(4)}°, ${latlng.lng.toFixed(4)}°`;
  liveContext = { elevation: null, weather: null, landCover: null, access: null };
  document.getElementById('accessReadout').textContent = 'Checking federal data…';
  document.getElementById('accessDetail').textContent = 'Always verify the managing agency’s rules';
  document.getElementById('weatherReadout').textContent = 'Loading…';
  document.getElementById('rainReadout').textContent = 'Fetching rainfall';
  document.getElementById('landCoverReadout').textContent = 'Loading…';
  document.getElementById('landCoverDetail').textContent = 'Classifying surface';
  updateResult();
  lookupElevation(latlng);
  lookupWeather(latlng);
  lookupLandCover(latlng);
  lookupAccess(latlng);
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
      current: 'temperature_2m,relative_humidity_2m,precipitation', hourly: 'precipitation,soil_temperature_0cm,soil_moisture_0_to_1cm',
      past_days: '31', forecast_days: '1', timezone: 'auto'
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
    const thirtyDayRain = hours.reduce((sum, time, index) => {
      const timestamp = new Date(time);
      return timestamp <= now && timestamp >= new Date(now - 30 * 24 * 60 * 60 * 1000) ? sum + Number(precipitation[index] || 0) : sum;
    }, 0);
    const temp = Math.round(Number(data.current?.temperature_2m));
    const humidity = Math.round(Number(data.current?.relative_humidity_2m));
    const currentRain = Number(data.current?.precipitation || 0);
    const rainMm = Math.round(lastDayRain * 10) / 10;
    const thirtyMm = Math.round(thirtyDayRain);
    const pastTimes = hours.map(time => new Date(time).getTime());
    const latestIndex = pastTimes.reduce((best, time, index) => time <= now.getTime() && time > (pastTimes[best] || -Infinity) ? index : best, 0);
    const soilTemp = Number(data.hourly?.soil_temperature_0cm?.[latestIndex]);
    const soilMoisture = Number(data.hourly?.soil_moisture_0_to_1cm?.[latestIndex]);
    liveContext.weather = { signal: `${rainMm} mm precipitation in the past 24h; live weather data loaded.` };
    rain.value = Math.min(Number(rain.max), Math.round(rainMm));
    document.getElementById('rainOutput').value = `${rainMm} mm`;
    document.getElementById('weatherReadout').textContent = `${temp}°C now`;
    document.getElementById('rainReadout').textContent = `${rainMm} mm / 24h · ${currentRain} mm now`;
    document.getElementById('airTempInput').value = Number.isFinite(temp) ? temp : '';
    document.getElementById('humidityInput').value = Number.isFinite(humidity) ? humidity : '';
    document.getElementById('precipInput').value = Number.isFinite(thirtyMm) ? thirtyMm : '';
    document.getElementById('soilTempInput').value = Number.isFinite(soilTemp) ? soilTemp.toFixed(1) : '';
    document.getElementById('moistureInput').value = !Number.isFinite(soilMoisture) ? 'unknown' : soilMoisture < .12 ? 'dry' : soilMoisture > .38 ? 'saturated' : 'moist';
    updateEstimator();
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

async function lookupAccess(latlng) {
  const thisRequest = ++accessRequest;
  try {
    const geometry = JSON.stringify({ x: latlng.lng, y: latlng.lat, spatialReference: { wkid: 4326 } });
    const params = new URLSearchParams({
      where: '1=1', geometry, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: 'ADMIN_AGENCY_CODE,ADMIN_UNIT_NAME,ADMIN_UNIT_TYPE,ADMIN_ST', returnGeometry: 'false', f: 'json'
    });
    const url = 'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_without_PriUnk/MapServer/1/query?' + params;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Access lookup failed');
    const data = await response.json();
    if (thisRequest !== accessRequest) return;
    const attributes = data.features?.[0]?.attributes;
    const manager = attributes?.ADMIN_AGENCY_CODE;
    const unit = attributes?.ADMIN_UNIT_NAME || attributes?.ADMIN_UNIT_TYPE;
    if (!manager || manager === 'PVT') {
      liveContext.access = { signal: 'Federal surface-manager data reports private or unknown ownership.' };
      document.getElementById('accessReadout').textContent = manager === 'PVT' ? 'Private / non-federal' : 'No federal match';
      document.getElementById('accessDetail').textContent = 'Do not assume access; verify ownership and permission.';
    } else {
      liveContext.access = { signal: `Federal surface-manager data reports ${manager}${unit ? ` (${unit})` : ''}.` };
      document.getElementById('accessReadout').textContent = `${manager}${unit ? ` · ${unit}` : ''}`;
      document.getElementById('accessDetail').textContent = 'Manager identified; foraging rules, closures, permits, and boundaries still require verification.';
    }
    updateResult();
  } catch (error) {
    if (thisRequest !== accessRequest) return;
    document.getElementById('accessReadout').textContent = 'Coverage unavailable';
    document.getElementById('accessDetail').textContent = 'Federal data is incomplete; do not infer access.';
  }
}

function updateOutputs() {
  document.getElementById('rainOutput').value = `${rain.value} mm`;
  document.getElementById('elevationOutput').value = `${Number(elevation.value).toLocaleString()} m`;
  if (selectedLatLng) updateResult();
}

function numberValue(id) { const value = Number(document.getElementById(id).value); return Number.isFinite(value) && document.getElementById(id).value !== '' ? value : null; }
function rangeFit(value, min, max, tolerance) { if (value === null) return null; if (value >= min && value <= max) return 1; const distance = value < min ? min - value : value - max; return Math.max(0, 1 - distance / tolerance); }
function categoricalFit(value, desired) { if (value === 'unknown') return null; return value === desired ? 1 : 0; }
function updateEstimator() {
  const factors = [
    ['Air temp', 5, rangeFit(numberValue('airTempInput'), 15, 20, 10)],
    ['Soil-surface temp', 5, rangeFit(numberValue('soilTempInput'), 17, 20, 10)],
    ['Humidity', 4, rangeFit(numberValue('humidityInput'), 76, 80, 30)],
    ['30-day precipitation', 5, rangeFit(numberValue('precipInput'), 60, 100, 120)],
    ['Soil moisture', 5, categoricalFit(document.getElementById('moistureInput').value, 'moist')],
    ['Soil pH', 5, rangeFit(numberValue('phInput'), 4, 5.5, 3)],
    ['Drainage', 4, categoricalFit(document.getElementById('drainageInput').value, 'well')],
    ['Canopy', 4, categoricalFit(document.getElementById('canopyInput').value, 'moderate')],
    ['Light', 3, (() => { const light = document.getElementById('lightInput').value; return light === 'unknown' ? null : (light === 'shade' || light === 'filtered' ? 1 : 0); })()],
    ['Soil nitrogen', 3, categoricalFit(document.getElementById('nitrogenInput').value, 'low')],
    ['Host tree', 3, categoricalFit(document.getElementById('hostInput').value, 'yes')],
    ['Accumulated GDD', 5, (() => { const gdd = numberValue('gddInput'); if (gdd === null) return null; return Math.max(rangeFit(gdd, 430, 570, 210), rangeFit(gdd, 800, 900, 250)); })()]
  ];
  const totalWeight = factors.reduce((sum, [, weight]) => sum + weight, 0);
  const known = factors.filter(([, , fit]) => fit !== null);
  const knownWeight = known.reduce((sum, [, weight]) => sum + weight, 0);
  const score = knownWeight ? Math.round(known.reduce((sum, [, weight, fit]) => sum + weight * fit, 0) / knownWeight * 100) : null;
  const label = score === null ? 'Add conditions to estimate compatibility.' : knownWeight / totalWeight < .55 ? 'Early estimate — more field inputs needed.' : score >= 75 ? 'Strong condition match — still verify in the field.' : score >= 50 ? 'Mixed condition match.' : 'Weak match to the supplied conditions.';
  document.getElementById('estimatorScore').textContent = score === null ? '—' : score;
  document.getElementById('estimatorLabel').textContent = label;
  document.getElementById('knownWeight').textContent = `${Math.round(knownWeight / totalWeight * 100)}%`;
  document.getElementById('factorBreakdown').innerHTML = factors.map(([name, weight, fit]) => `<li>${name}: ${fit === null ? 'unknown' : `${Math.round(fit * 100)}%`} <em>×${weight}</em></li>`).join('');
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

function saveLocalFieldData() {
  localStorage.setItem('sporeScoutFieldData', JSON.stringify({ waypoints, trackPoints }));
}

function refreshOfflineStatus() {
  const online = navigator.onLine ? 'Online' : 'Offline';
  const trackState = trackWatchId === null ? 'track saved on this device' : `${trackPoints.length} points recording`;
  document.getElementById('offlineStatus').textContent = `${online} · ${trackState}`;
}

window.addEventListener('online', refreshOfflineStatus);
window.addEventListener('offline', refreshOfflineStatus);

document.getElementById('trackButton').addEventListener('click', () => {
  const button = document.getElementById('trackButton');
  if (trackWatchId !== null) {
    navigator.geolocation.clearWatch(trackWatchId);
    trackWatchId = null;
    button.textContent = 'Start track';
    button.classList.remove('is-recording');
    saveLocalFieldData();
    refreshOfflineStatus();
    return;
  }
  if (!navigator.geolocation) return showToast('This browser does not support location tracking.');
  trackPoints = [];
  if (trackLine) map.removeLayer(trackLine);
  trackWatchId = navigator.geolocation.watchPosition(position => {
    const point = [position.coords.latitude, position.coords.longitude];
    trackPoints.push(point);
    if (trackLine) trackLine.setLatLngs(trackPoints); else trackLine = L.polyline(trackPoints, { color: '#b85c3f', weight: 4, opacity: .9 }).addTo(map);
    map.panTo(point, { animate: true });
    saveLocalFieldData();
    refreshOfflineStatus();
  }, () => {
    showToast('Location tracking needs permission.');
    navigator.geolocation.clearWatch(trackWatchId); trackWatchId = null;
    button.textContent = 'Start track'; button.classList.remove('is-recording'); refreshOfflineStatus();
  }, { enableHighAccuracy: true, maximumAge: 5000 });
  button.textContent = 'Stop track';
  button.classList.add('is-recording');
  refreshOfflineStatus();
});

document.getElementById('waypointButton').addEventListener('click', () => {
  if (!selectedLatLng) return showToast('Drop a pin before saving a waypoint.');
  const point = { lat: selectedLatLng.lat, lng: selectedLatLng.lng, createdAt: new Date().toISOString() };
  waypoints.push(point);
  L.circleMarker([point.lat, point.lng], { radius: 6, color: '#214e3e', weight: 2, fillColor: '#fff', fillOpacity: 1 }).addTo(map).bindTooltip('Saved waypoint');
  saveLocalFieldData();
  showToast(`Waypoint ${waypoints.length} saved on this device.`);
});

document.getElementById('resetButton').addEventListener('click', () => {
  selectedKey = 'russula'; rain.value = 34; elevation.value = 1460; season.value = 'summer'; selectedLatLng = null; liveContext = { elevation: null, weather: null, landCover: null, access: null };
  document.getElementById('accessReadout').textContent = 'Waiting for pin';
  document.getElementById('accessDetail').textContent = 'Not a permission decision';
  document.getElementById('estimatorPin').textContent = 'No location selected';
  ['airTempInput','soilTempInput','humidityInput','precipInput','phInput','gddInput'].forEach(id => document.getElementById(id).value = '');
  ['moistureInput','drainageInput','canopyInput','lightInput','nitrogenInput','hostInput'].forEach(id => document.getElementById(id).value = 'unknown');
  updateEstimator();
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
['airTempInput','soilTempInput','humidityInput','precipInput','phInput','gddInput','moistureInput','drainageInput','canopyInput','lightInput','nitrogenInput','hostInput'].forEach(id => document.getElementById(id).addEventListener('input', updateEstimator));
function restoreLocalFieldData() {
  try {
    const saved = JSON.parse(localStorage.getItem('sporeScoutFieldData') || '{}');
    waypoints = Array.isArray(saved.waypoints) ? saved.waypoints : [];
    trackPoints = Array.isArray(saved.trackPoints) ? saved.trackPoints : [];
    waypoints.forEach(point => L.circleMarker([point.lat, point.lng], { radius: 6, color: '#214e3e', weight: 2, fillColor: '#fff', fillOpacity: 1 }).addTo(map).bindTooltip('Saved waypoint'));
    if (trackPoints.length > 1) trackLine = L.polyline(trackPoints, { color: '#b85c3f', weight: 4, opacity: .9 }).addTo(map);
  } catch (error) { localStorage.removeItem('sporeScoutFieldData'); }
  refreshOfflineStatus();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

renderSpecies();
updateOutputs();
updateEstimator();
initializeMap();
restoreLocalFieldData();

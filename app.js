const species = {
  russula: { name: 'Russula', subtitle: 'brittlegill', icon: '🍄', ideal: { rain: 38, elevation: 1250, seasons: ['summer', 'fall'] }, signals: ['Mixed woodland signal', 'Moisture level is within range', 'Broadleaf cover nearby'] },
  hawksWing: { name: "Hawk’s wing", subtitle: 'Sarcodon imbricatus', icon: '🪶', ideal: { rain: 48, elevation: 1880, seasons: ['summer', 'fall'] }, signals: ['Conifer-associated terrain', 'Cooler elevation signal', 'Seasonal window is favorable'] },
  chanterelle: { name: 'Chanterelle', subtitle: 'Cantharellus', icon: '🌼', ideal: { rain: 55, elevation: 900, seasons: ['summer', 'fall'] }, signals: ['Warm, moist forest conditions', 'Rain signal supports fruiting', 'Potential mixed canopy'] },
  morel: { name: 'Morel', subtitle: 'Morchella', icon: '◖◗', ideal: { rain: 26, elevation: 700, seasons: ['spring'] }, signals: ['Spring timing is important', 'Moderate moisture signal', 'Disturbed-ground proxy'] }
};

let selectedKey = 'russula';
let hasPin = false;
let pinX = 54;
let pinY = 44;

const grid = document.getElementById('speciesGrid');
const map = document.getElementById('map');
const pin = document.getElementById('mapPin');
const hint = document.getElementById('mapHint');
const emptyState = document.getElementById('emptyState');
const results = document.getElementById('resultContent');
const rain = document.getElementById('rainRange');
const elevation = document.getElementById('elevationRange');
const season = document.getElementById('seasonSelect');
const toast = document.getElementById('toast');

function renderSpecies() {
  grid.innerHTML = Object.entries(species).map(([key, item]) => `
    <button class="species-card ${key === selectedKey ? 'selected' : ''}" role="radio" aria-checked="${key === selectedKey}" data-species="${key}">
      <span class="species-icon">${item.icon}</span><strong>${item.name}</strong><small>${item.subtitle}</small>
    </button>`).join('');
  grid.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    selectedKey = button.dataset.species;
    renderSpecies();
    if (hasPin) updateResult();
  }));
}

function calculateScore() {
  const item = species[selectedKey];
  const rainGap = Math.abs(Number(rain.value) - item.ideal.rain);
  const elevationGap = Math.abs(Number(elevation.value) - item.ideal.elevation) / 24;
  const seasonBonus = item.ideal.seasons.includes(season.value) ? 15 : -13;
  const locationVariation = Math.round(((pinX * 3 + pinY * 7) % 17) - 8);
  return Math.max(12, Math.min(94, Math.round(78 - rainGap * .72 - elevationGap + seasonBonus + locationVariation)));
}

function updateResult() {
  const item = species[selectedKey];
  const score = calculateScore();
  const label = score >= 75 ? 'Promising' : score >= 52 ? 'Possible' : 'Less likely';
  const seasonText = item.ideal.seasons.includes(season.value) ? 'Season aligns with this species’ usual fruiting window.' : 'Season is outside this species’ strongest fruiting window.';
  const signals = [...item.signals];
  signals.push(seasonText);
  document.getElementById('scoreSpecies').textContent = `${item.name} habitat`;
  document.getElementById('scoreLabel').textContent = label;
  document.getElementById('scoreValue').textContent = score;
  document.getElementById('scoreRing').style.borderRightColor = score >= 75 ? '#214e3e' : score >= 52 ? '#d28a36' : '#b85c3f';
  document.getElementById('resultSummary').textContent = score >= 75 ? `This pin has several conditions that could support ${item.name} habitat. Treat it as a lead to investigate, not a sighting.` : score >= 52 ? `There are a few useful signals at this pin, but the conditions are mixed for ${item.name}.` : `Current settings do not strongly match typical ${item.name} habitat. Another location or season may be more promising.`;
  document.getElementById('signalList').innerHTML = signals.slice(0, 3).map((signal, index) => `<li class="${index === 2 && score < 52 ? 'negative' : ''}">${signal}</li>`).join('');
}

function placePin(clientX, clientY) {
  const bounds = map.getBoundingClientRect();
  pinX = Math.max(4, Math.min(96, ((clientX - bounds.left) / bounds.width) * 100));
  pinY = Math.max(9, Math.min(96, ((clientY - bounds.top) / bounds.height) * 100));
  pin.style.left = `${pinX}%`;
  pin.style.top = `${pinY}%`;
  pin.classList.remove('is-hidden');
  hint.classList.add('is-hidden');
  emptyState.classList.add('is-hidden');
  results.classList.remove('is-hidden');
  hasPin = true;
  document.getElementById('mapStatus').textContent = `Pin placed · ${Math.round(40.4 + pinY / 100 * .08)}° N, ${Math.round(105.2 + pinX / 100 * .1)}° W`;
  updateResult();
}

map.addEventListener('click', (event) => { if (event.target !== pin && !pin.contains(event.target)) placePin(event.clientX, event.clientY); });
map.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); const b = map.getBoundingClientRect(); placePin(b.left + b.width / 2, b.top + b.height / 2); } });

function updateOutputs() {
  document.getElementById('rainOutput').value = `${rain.value} mm`;
  document.getElementById('elevationOutput').value = `${Number(elevation.value).toLocaleString()} m`;
  if (hasPin) updateResult();
}
[rain, elevation, season].forEach(control => control.addEventListener('input', updateOutputs));

document.getElementById('resetButton').addEventListener('click', () => {
  selectedKey = 'russula'; rain.value = 34; elevation.value = 1460; season.value = 'summer'; hasPin = false;
  pin.classList.add('is-hidden'); hint.classList.remove('is-hidden'); emptyState.classList.remove('is-hidden'); results.classList.add('is-hidden');
  document.getElementById('mapStatus').textContent = 'Click the map to place a pin'; renderSpecies(); updateOutputs();
});
document.getElementById('locateButton').addEventListener('click', () => { const b = map.getBoundingClientRect(); placePin(b.left + b.width * .54, b.top + b.height * .44); });
document.getElementById('detailsButton').addEventListener('click', () => showToast('Score details are the next screen to build.')); 
document.getElementById('menuButton').addEventListener('click', () => showToast('Mobile navigation is ready for its next content pass.'));
function showToast(message) { toast.textContent = message; toast.classList.remove('is-hidden'); setTimeout(() => toast.classList.add('is-hidden'), 2500); }

renderSpecies();
updateOutputs();

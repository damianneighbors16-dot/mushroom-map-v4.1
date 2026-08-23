# Mushroom Habitat Explorer

A responsive UI prototype for exploring **habitat suitability** for different mushroom species. It lets a user choose a species, adjust seasonal conditions, and place a map pin to view a transparent, mock suitability score.

## What is implemented

- Live OpenStreetMap basemap: click anywhere to drop/move a location pin
- Optional browser geolocation (only after the user presses “Use my location”)
- Live elevation lookup for the pin from Open-Meteo’s Elevation API
- Live temperature and trailing 24-hour precipitation from Open-Meteo’s Forecast API
- Point-level global land-cover classification from Esri’s Sentinel-2 10m Land Cover service
- Nationwide federal surface-manager check using BLM’s Surface Management Agency data, with private/non-federal and coverage-gap warnings
- Locally saved waypoints and optional GPS track recording, plus an offline app-shell cache
- Species filters for Russula, Hawk's Wing, Chanterelle, and Morel
- Season, elevation, and recent-rain controls
- A score card that updates based on the selected species, pin location, and controls
- Experimental Chanterelle habitat estimator that combines live temperature, humidity, 30-day precipitation, and soil-surface moisture with field inputs
- Nearby habitat signals and a transparent score explanation
- Mobile-friendly layout

## Experimental Chanterelle habitat estimator
The app now includes a transparent Chanterelle compatibility estimator using Damian?s supplied targets and weights. A dropped pin fills available temperature, humidity, precipitation, and soil-surface moisture inputs from live sources; pH, drainage, canopy, light, soil nitrogen, host-tree, and growing-degree-day inputs remain field observations. The live 30-day precipitation is used as a practical proxy for the supplied cumulative/monthly rainfall targets and is scored once to avoid double-counting.

The score expresses only compatibility with this experimental rubric. It is not a calibrated probability, a finding record, a species identification, a harvest recommendation, or an access decision. Growing degree days are manually entered using the supplied base of 5?C / 41?F until a validated historical climate calculation is added.

## Important prototype limits

Map coordinates, elevation, live weather/precipitation, satellite land-cover class, and a federal surface-manager lookup are real data layers. The access layer is **not a permission decision**: it has nationwide coverage gaps and does not determine ownership, boundaries, closures, permits, tribal jurisdiction, local rules, or whether foraging is allowed. The app shell, saved waypoints, and track data can work offline after first load, but map tiles are not downloaded for offline navigation. The suitability score, canopy/substrate signals, tree-species associations, and species rules remain deliberately simulated UI logic. This is **not evidence that a species is present**, not an identification tool, and not advice that anything is edible.

## Run it locally

Open `index.html` in a browser. No build step is required.

## Suggested next build steps

1. Replace the simulated map and scoring logic with validated data sources.
2. Add a real map provider and geolocation/search.
3. Add observation-source attribution, confidence, and land-access/foraging rules.
4. Add accounts and saved spots only after privacy rules are defined.

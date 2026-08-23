# Mushroom Habitat Explorer

A responsive UI prototype for exploring **habitat suitability** for different mushroom species. It lets a user choose a species, adjust seasonal conditions, and place a map pin to view a transparent, mock suitability score.

## What is implemented

- Interactive map area: click anywhere to drop/move a location pin
- Species filters for Russula, Hawk's Wing, Chanterelle, and Morel
- Season, elevation, and recent-rain controls
- A score card that updates based on the selected species, pin location, and controls
- Nearby habitat signals and a transparent score explanation
- Mobile-friendly layout

## Important prototype limits

The score is deliberately simulated UI logic, not field guidance. It is **not evidence that a species is present**, not an identification tool, and not advice that anything is edible. A production version should use validated occurrence, weather, land-cover, elevation, substrate, and permissions data, and should retain prominent safety guidance.

## Run it locally

Open `index.html` in a browser. No build step is required.

## Suggested next build steps

1. Replace the simulated map and scoring logic with validated data sources.
2. Add a real map provider and geolocation/search.
3. Add observation-source attribution, confidence, and land-access/foraging rules.
4. Add accounts and saved spots only after privacy rules are defined.

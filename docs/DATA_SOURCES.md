# AeroSense live data policy

AeroSense separates authoritative external data from local application state.

1. **WHO Disease Outbreak News**: current outbreak notices are fetched server-side. Source links are preserved in each record where available.
2. **WHO GHO**: indicators are retrieved through the WHO GHO OData service. The API may not contain every disease dataset; the UI never substitutes invented counts.
3. **Atmospheric data**: Open-Meteo provides weather and air-quality observations/forecast variables. These are used for environmental exposure scoring.
4. **Hospitals**: OpenStreetMap/Overpass is used for nearby mapped healthcare facilities. The app labels this as map data, not an official emergency dispatch directory.

For emergency situations, users should call their local emergency service and verify facility availability before travel.

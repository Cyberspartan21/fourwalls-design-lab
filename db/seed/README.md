# Entwicklungsbestand

Seit P5.3 gibt es keine Seed-SQL mehr. Der Bestand entsteht reproduzierbar über den
Demo-Importer: `cd app && npm run db:import` (oder `node scripts/migrate.mjs --seed`).
Quelle ist der Prototyp (`final/listings.js`, `final/properties.js`,
`final/ufer/detail-data.js`, `final/ufer/geo.js`); die Abbildung ist im Kopf von
`app/scripts/import-demo.mjs` dokumentiert. Bericht: `app/var/import-bericht.json`.

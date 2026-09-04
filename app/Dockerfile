# FOURWALLS — Container (P5.5 §43–§48).
#
# WICHTIG — Build-Kontext ist das Repository-Wurzelverzeichnis, NICHT app/:
# db/ (Migrationen + Schema-Zusagen für migrate.mjs) liegt neben app/, nicht
# darin, und Docker kann nur kopieren, was im Kontext liegt. Aufruf also aus
# dem Repository-Wurzelverzeichnis (fourwalls/), mit -f auf diese Datei:
#
#   docker build -f app/Dockerfile -t fourwalls-app:p55-lokal .
#
# Ein Abbild für alle Umgebungen (development/staging/production): die echte
# Konfiguration kommt erst zur Laufzeit über `docker run -e …`
# (server/env.ts prüft sie beim Start, fail closed). Die Build-Stufe braucht
# trotzdem PLATZHALTERWERTE — next build importiert beim „Collecting page
# data“ Routen, die server/db.ts laden, und das ruft env() und postgres(...)
# bereits beim Modul-Laden auf (kein echter Verbindungsaufbau, aber eine
# gültige DATABASE_URL muss die Zod-Prüfung bestehen). Diese Platzhalter
# verlassen die Build-Stufe nicht und landen nicht im Abbild.
#
# Basisimage per Digest gepinnt (nicht per Tag — ein Tag kann sich unter
# einem weiterbewegen, ein Digest nicht):
#   docker pull node:22-bookworm-slim
#   docker inspect --format '{{index .RepoDigests 0}}' node:22-bookworm-slim

FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS build
WORKDIR /app

# Abhängigkeiten zuerst, für den Docker-Layer-Cache. typescript ist eine
# devDependency und wird für `next build` gebraucht — darum hier `npm ci`
# ohne --omit=dev; keine eigene "deps"-Stufe, die Build-Stufe ist genug.
COPY app/package.json app/package-lock.json ./
RUN npm ci

COPY app/ .

ENV NEXT_TELEMETRY_DISABLED=1 \
    APP_ENV=test \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
    STORAGE_PROVIDER=local \
    MAIL_PROVIDER=dev \
    MAIL_FROM=noreply@fourwalls.example \
    MAIL_DEV_SINK=dev-sink@fourwalls.example \
    APP_SECRET=build-stufe-platzhalter-keine-echten-daten-00

RUN npm run build


FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# output: "standalone" (next.config.ts) — nur der abhängigkeitsfreie Server,
# kein volles node_modules. .next/static und public liegen nicht im
# Standalone-Ordner und müssen von Hand dazu (Next-Dokumentation).
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# migrate.mjs bestimmt seinen Ordner selbst (import.meta.url) und geht von
# dort zwei Ebenen hoch zu db/ (join(hier, "..", "..", "db")) — darum genau
# dieser Pfad: /app/app/scripts/migrate.mjs → /app/db.
COPY --chown=node:node app/scripts/migrate.mjs ./app/scripts/migrate.mjs
COPY --chown=node:node db ./db

# postgres (für migrate.mjs, das next build NICHT verfolgt — es ist kein
# Next-Modul) und sharp samt seinen nativen @img/*-Binärdateien (für den
# Fall, dass Next deren Tracing in den Standalone-Ordner verfehlt) explizit
# aus der Build-Stufe nachziehen. Beide Kopien sind idempotent — dieselbe
# Version wie im Standalone-node_modules, kein Konflikt.
COPY --from=build --chown=node:node /app/node_modules/postgres ./node_modules/postgres
COPY --from=build --chown=node:node /app/node_modules/sharp ./node_modules/sharp
COPY --from=build --chown=node:node /app/node_modules/@img ./node_modules/@img

USER node

# Kein curl im slim-Abbild — Node hat ein globales fetch (seit Node 18).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

EXPOSE 3000
CMD ["node", "server.js"]

#!/usr/bin/env bash
# FOURWALLS — einmalig ein selbstsigniertes Zertifikat für die lokale
# Mail-Attrappe (Mailpit) erzeugen. Nur für STARTTLS gegen localhost;
# kein echtes Geheimnis, aber bewusst NICHT eingecheckt (siehe .gitignore).
set -euo pipefail
HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZIEL="$HIER/mail-tls"
mkdir -p "$ZIEL"
if [ -f "$ZIEL/cert.pem" ] && [ -f "$ZIEL/key.pem" ]; then
  echo "Zertifikat existiert bereits: $ZIEL"
  exit 0
fi
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$ZIEL/key.pem" -out "$ZIEL/cert.pem" \
  -days 3650 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
chmod 644 "$ZIEL/key.pem" "$ZIEL/cert.pem"
echo "Zertifikat erzeugt: $ZIEL"

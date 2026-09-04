/* Speicherschlüssel — die eine Stelle, die sagt, was ein Schlüssel ist und
   ob er privat oder öffentlich liegt. Rein, ohne server-only, damit sowohl
   die Anwendung als auch Tests und Skripte sie laden können.

     orig/<uuid>.<ext>            Original eines Uploads        PRIVAT
     upload/<uuid>.<ext>          P5.4-Altbestand (eine Datei)  PRIVAT
     abl/<uuid>/<breite>.<fmt>    Ableitung, unveröffentlicht    PRIVAT
     pub/<uuid>/<breite>.<fmt>    Ableitung, veröffentlicht      ÖFFENTLICH
     demo/<name>                  Demo-Bestand                   ÖFFENTLICH */

export type Bereich = "privat" | "oeffentlich";

export function bereichVon(storageKey: string): Bereich {
  if (/^(pub|demo)\//.test(storageKey)) return "oeffentlich";
  if (/^(orig|upload|abl)\//.test(storageKey)) return "privat";
  throw new Error("Unbekannter Schlüsselpräfix");
}

/* Ein Schlüssel ist eine Kennung mit Erweiterung, nie ein Pfad aus dem Browser. */
export const SCHLUESSEL_FORM = /^(orig|upload)\/[a-f0-9-]{36}\.(jpg|png|webp)$|^(abl|pub)\/[a-f0-9-]{36}\/\d{3,4}\.(jpg|webp|avif)$|^demo\/[a-z0-9][a-z0-9._-]*$/i;

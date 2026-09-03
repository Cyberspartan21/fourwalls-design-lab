#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Erzeugt portal-23/24/25/27/29.src.html aus portal-28.src.html.
Die Funktionslogik ist geteilt (bewusst); Identität kommt aus Schriften,
Farbtokens und einem konzeptspezifischen Struktur-Override je Welt."""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "concepts"
BASIS = (ROOT / "portal-28.src.html").read_text()

KONZEPTE = {
    "23": dict(
        name="Schwelle",
        fonts='<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..500;1,6..72,200..400&family=Hanken+Grotesk:wght@300;400;500&display=swap" rel="stylesheet">',
        d="'Newsreader',Georgia,serif", t="'Hanken Grotesk',system-ui,sans-serif",
        dunkel="--gr:#101F1A; --gr2:#16291F; --gr3:#1C3226; --ink:#EDE6D5; --leise:#93A398;\n  --linie:rgba(237,230,213,.18); --licht:#C9A227; --tief:#0A1512;\n  --gut:#8FB08A; --warn:#C4838A;",
        hell="--gr:#F2EAD9; --gr2:#EADFC9; --gr3:#E0D3B8; --ink:#101F1A; --leise:#5C6B62;\n  --linie:rgba(16,31,26,.18); --licht:#7A6A1E; --tief:#101F1A;\n  --gut:#4E7A49; --warn:#9A4A54;",
        default_mode="hell",
        override="""
/* ===== SCHWELLE-Override: editoriale Zeilen statt Kacheln ===== */
#w .gitter{grid-template-columns:1fr;gap:0;padding-top:6px}
#w .inserat{flex-direction:row;background:none;border:0;border-bottom:1px solid var(--linie);
  padding:clamp(14px,1.6vw,20px) 0;gap:clamp(14px,2vw,26px)}
#w .inserat:hover{border-color:var(--linie)}
#w .inserat figure{width:clamp(150px,24vw,280px);aspect-ratio:3/2;flex:0 0 auto}
#w .inserat:hover img{transform:scale(1.04)}
#w .inserat .lauftext{padding:2px 0;gap:6px}
#w .inserat .tit{font-family:var(--d);font-weight:300;font-size:clamp(1.1rem,2vw,1.5rem);line-height:1.15;order:-1}
#w .inserat .preis{font-family:var(--t);font-size:.95rem}
#w .inserat .zeilen{border-top:0;padding-top:2px}
#w .resultkopf h1{font-weight:200;letter-spacing:-.01em}
#w .kopf{background:var(--gr);backdrop-filter:none}
#w .knopf.voll{color:var(--gr)}
#w .dheld img{aspect-ratio:16/8.4}
@media(max-width:700px){#w .inserat{flex-direction:column;gap:10px}#w .inserat figure{width:100%}}
""",
    ),
    "24": dict(
        name="Vorhang",
        fonts='<link href="https://fonts.googleapis.com/css2?family=Petrona:ital,wght@0,200..500;1,200..400&family=Manrope:wght@200;300;400;500&display=swap" rel="stylesheet">',
        d="'Petrona',Georgia,serif", t="'Manrope',system-ui,sans-serif",
        dunkel="--gr:#2A1013; --gr2:#351A1C; --gr3:#402226; --ink:#F0E6D8; --leise:#AD9389;\n  --linie:rgba(240,230,216,.2); --licht:#C9974A; --tief:#1B0A0C;\n  --gut:#8FB08A; --warn:#D08A93;",
        hell="--gr:#F4EDE1; --gr2:#ECE2D0; --gr3:#E2D5BE; --ink:#241C16; --leise:#6E6357;\n  --linie:rgba(36,28,22,.2); --licht:#A87A2E; --tief:#241C16;\n  --gut:#4E7A49; --warn:#9A4A54;",
        default_mode="hell",
        override="""
/* ===== VORHANG-Override: Bühnenkarten mit Goldkante ===== */
#w .inserat{border:0;border-left:2px solid transparent;background:var(--gr2);
  transition:border-color .3s,background .3s}
#w .inserat:hover{border-left-color:var(--licht);background:var(--gr3)}
#w .inserat .preis{font-family:var(--d);font-weight:400;font-size:1.15rem}
#w .inserat figure{aspect-ratio:16/10}
#w .etikett span{background:var(--licht);color:var(--tief);font-weight:600}
#w .etikett .ex{background:var(--tief);color:var(--licht)}
#w .resultkopf h1{font-weight:200}
#w .dfakten div{background:var(--gr2)}
#w .dheld{position:relative}
#w .dheld::before,#w .dheld::after{content:"";position:absolute;top:0;bottom:0;width:10%;z-index:2;pointer-events:none;
  background:linear-gradient(to right,var(--gr),transparent)}
#w .dheld::after{right:0;left:auto;background:linear-gradient(to left,var(--gr),transparent)}
""",
    ),
    "25": dict(
        name="Kabinett",
        fonts='<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Figtree:wght@300;400;500&display=swap" rel="stylesheet">',
        d="'Cormorant Garamond',Garamond,serif", t="'Figtree',system-ui,sans-serif",
        dunkel="--gr:#1A1917; --gr2:#232120; --gr3:#2C2A28; --ink:#EDE8DF; --leise:#948E85;\n  --linie:rgba(237,232,223,.2); --licht:#EDE8DF; --tief:#121110;\n  --gut:#8FB08A; --warn:#C4838A;",
        hell="--gr:#EFEBE3; --gr2:#E5E0D6; --gr3:#DBD5C8; --ink:#1C1A17; --leise:#6A665F;\n  --linie:rgba(28,26,23,.2); --licht:#1C1A17; --tief:#1C1A17;\n  --gut:#4E7A49; --warn:#9A4A54;",
        default_mode="hell",
        override="""
/* ===== KABINETT-Override: rahmenlose Sammlung, ungleiche Spannen, monochrom ===== */
#w .gitter{grid-template-columns:repeat(6,1fr)}
#w .inserat{background:none;border:0;grid-column:span 2}
#w .gitter .inserat:nth-child(8n+1){grid-column:span 3}
#w .gitter .inserat:nth-child(8n+5){grid-column:span 3}
#w .gitter .inserat:nth-child(8n+1) figure{aspect-ratio:4/3}
#w .inserat:hover{border:0}
#w .inserat img{filter:saturate(.6)}
#w .inserat:hover img{filter:saturate(1)}
#w .inserat .lauftext{padding:12px 0 0;border-top:1px solid var(--linie);margin-top:12px}
#w .inserat .preis{font-family:var(--t);font-weight:400;font-size:.92rem}
#w .inserat .tit{font-family:var(--d);font-weight:400;font-size:1.28rem;line-height:1.15;order:-1}
#w .inserat .zeilen{border-top:0;padding-top:2px}
#w .etikett span{background:var(--gr);color:var(--ink);border:1px solid var(--linie)}
#w .etikett .ex{background:var(--ink);color:var(--gr);font-weight:500}
#w .knopf.voll{background:var(--ink);border-color:var(--ink);color:var(--gr)}
#w .zaehlchip{background:var(--ink);color:var(--gr)}
#w .resultkopf h1{font-weight:300}
#w .merkknopf[aria-pressed="true"]{color:#fff}
@media(max-width:900px){#w .gitter{grid-template-columns:1fr 1fr}#w .inserat,#w .gitter .inserat:nth-child(8n+1),#w .gitter .inserat:nth-child(8n+5){grid-column:span 1}}
@media(max-width:560px){#w .gitter{grid-template-columns:1fr}}
""",
    ),
    "27": dict(
        name="Stapel",
        fonts='<link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Sora:wght@200;300;400&display=swap" rel="stylesheet">',
        d="'Marcellus',Georgia,serif", t="'Sora',system-ui,sans-serif",
        dunkel="--gr:#14171A; --gr2:#1E2226; --gr3:#272C31; --ink:#E9EBE7; --leise:#868C8A;\n  --linie:rgba(233,235,231,.18); --licht:#E9EBE7; --tief:#0D0F11;\n  --gut:#8FB08A; --warn:#C4838A;",
        hell="--gr:#E9EAE7; --gr2:#DDDFDB; --gr3:#D1D4CF; --ink:#14171A; --leise:#5F6563;\n  --linie:rgba(20,23,26,.2); --licht:#14171A; --tief:#14171A;\n  --gut:#4E7A49; --warn:#9A4A54;",
        default_mode="dunkel",
        override="""
/* ===== STAPEL-Override: dichte Geschoss-Zeilen statt Kacheln ===== */
#w .gitter{display:block;padding-top:4px}
#w .inserat{flex-direction:row;align-items:center;background:none;border:0;
  border-bottom:1px solid var(--linie);padding:12px 0;gap:clamp(12px,1.8vw,24px);
  counter-increment:geschoss}
#w .inserat::before{content:counter(geschoss,decimal-leading-zero);
  font-family:var(--d);font-size:1.1rem;color:var(--leise);min-width:2.2em;flex:0 0 auto}
#w .gitter{counter-reset:geschoss}
#w .inserat:hover{background:var(--gr2);border-color:var(--linie)}
#w .inserat figure{width:104px;aspect-ratio:3/2;flex:0 0 auto}
#w .inserat .lauftext{padding:0;display:grid;flex:1;
  grid-template-columns:minmax(160px,2fr) minmax(110px,1fr) auto;align-items:center;gap:8px 18px}
#w .inserat .tit{font-size:.9rem}
#w .inserat .ort{grid-column:1}
#w .inserat .preis{grid-column:3;grid-row:1/span 2;font-family:var(--d);font-size:1.15rem;text-align:right}
#w .inserat .zeilen{grid-column:2;grid-row:1/span 2;border:0;padding:0;flex-direction:column;gap:3px}
#w .inserat .spiegellinie{display:none}
#w .inserat figure .etikett{display:none}
#w .inserat .zeilen .quelle{display:inline;margin-left:0}
#w .merkknopf{background:none;color:var(--leise)}
#w .knopf.voll{background:var(--ink);border-color:var(--ink);color:var(--gr)}
#w .zaehlchip{background:var(--ink);color:var(--gr)}
#w .resultkopf h1{font-weight:400}
@media(max-width:760px){
  #w .inserat::before{display:none}
  #w .inserat .lauftext{grid-template-columns:1fr auto}
  #w .inserat .zeilen{grid-column:1;grid-row:auto;flex-direction:row;gap:10px}
  #w .inserat .preis{grid-column:2;grid-row:1}
}
""",
    ),
    "29": dict(
        name="Nähe",
        fonts='<link href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Archivo:ital,wdth,wght@0,75..112,200..600;1,75..112,300..500&display=swap" rel="stylesheet">',
        d="'Young Serif',Georgia,serif", t="'Archivo',system-ui,sans-serif",
        dunkel="--gr:#17120E; --gr2:#211A14; --gr3:#2B221A; --ink:#F0E9DF; --leise:#9C9086;\n  --linie:rgba(240,233,223,.2); --licht:#E2673C; --tief:#0B0806;\n  --gut:#8FB08A; --warn:#D08A93;",
        hell="--gr:#EDEFEF; --gr2:#E2E5E5; --gr3:#D6DADA; --ink:#14181A; --leise:#5F6A6D;\n  --linie:rgba(20,24,26,.18); --licht:#C8401E; --tief:#0C0E0F;\n  --gut:#4E7A49; --warn:#9A4A54;",
        default_mode="hell",
        override="""
/* ===== NÄHE-Override: Massstabs-Detail an jeder Karte ===== */
#w .inserat{border-radius:0}
#w .inserat figure{aspect-ratio:4/3}
#w .inserat .ort{position:relative;padding-left:26px}
#w .inserat .ort::before{content:"";position:absolute;left:0;top:50%;width:18px;height:1px;background:var(--licht)}
#w .inserat .preis{font-family:var(--d);font-weight:400;font-size:1.05rem}
#w .inserat .tit{font-size:.88rem}
#w .etikett .ex{background:var(--licht);color:#fff}
#w .knopf.voll{color:#fff}
#w .resultkopf h1{font-weight:400;letter-spacing:0}
#w .dkern h2{font-weight:400}
""",
    ),
}

fonts28 = '<link href="https://fonts.googleapis.com/css2?family=Italiana&family=Host+Grotesk:ital,wght@0,300..600;1,300..400&display=swap" rel="stylesheet">'

for nr, K in KONZEPTE.items():
    s = BASIS
    s = s.replace("<title>FOURWALLS Portal — Spiegel</title>", f"<title>FOURWALLS Portal — {K['name']}</title>")
    assert fonts28 in s
    s = s.replace(fonts28, K["fonts"])
    # Tokens dunkel
    s = re.sub(r"--gr:#080C11;.*?--gut:#7FA97A; --warn:#C4838A;", K["dunkel"], s, count=1, flags=re.S)
    # Tokens hell
    s = re.sub(r"--gr:#E7E9EA;.*?--gut:#4E7A49; --warn:#9A4A54;", K["hell"], s, count=1, flags=re.S)
    # Schriften
    s = s.replace("--d:'Italiana',Didot,'Times New Roman',serif;", f"--d:{K['d']};")
    s = s.replace("--t:'Host Grotesk','Helvetica Neue',system-ui,sans-serif;", f"--t:{K['t']};")
    s = s.replace("'Host Grotesk',sans-serif", K["t"].split(",")[0].strip("'\"") and K["t"].replace("system-ui,sans-serif", "sans-serif"))
    # Default-Modus + Speicher-Schlüssel (geteilt mit der Konzept-Homepage)
    s = s.replace('<div id="w" data-mode="dunkel">', f'<div id="w" data-mode="{K["default_mode"]}">')
    s = s.replace('let start = "dunkel";', f'let start = "{K["default_mode"]}";')
    s = s.replace('"fw28"', f'"fw{nr}"')
    # Links zur Homepage
    s = s.replace("concept-28.html", f"concept-{nr}.html")
    # Fusszeile
    s = s.replace("Portal-Prototyp «Spiegel»", f"Portal-Prototyp «{K['name']}»")
    # Override-Block vor Ende des Styles
    marker = "/* ============ Mobil ============ */"
    assert marker in s
    s = s.replace(marker, K["override"] + "\n" + marker, 1)
    (ROOT / f"portal-{nr}.src.html").write_text(s)
    print("portal-%s.src.html (%s) geschrieben" % (nr, K["name"]))

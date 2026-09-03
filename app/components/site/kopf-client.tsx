"use client";
import { useEffect } from "react";

/* Verhalten der Kopfleiste — Port aus UFER.montiere(): Untermenüs mit
   Verzögerung, Tastatur, Escape; mobiles Blatt; Tag/Abend; schwebender Kopf
   über dem Held. Rendert nichts, hängt sich an das Server-Markup. */
export function KopfClient() {
  useEffect(() => {
    const $ = (id: string) => document.getElementById(id);
    const kopf = document.querySelector<HTMLElement>(".kopf"), blatt = $("blatt");
    if (!kopf) return;
    const ab: (() => void)[] = [];
    const on = <K extends keyof HTMLElementEventMap>(el: Element | Document | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void, opt?: AddEventListenerOptions) => { if (!el) return; el.addEventListener(ev, fn as EventListener, opt); ab.push(() => el.removeEventListener(ev, fn as EventListener, opt)); };

    /* Modus */
    const setz = (m: "hell" | "dunkel") => { document.body.dataset.mode = m; try { localStorage.setItem("fw-ufer", m); } catch { /* */ } sync(); };
    const sync = () => { const m = document.body.dataset.mode || "hell"; $("gtHell")?.setAttribute("aria-pressed", String(m === "hell")); $("gtDunkel")?.setAttribute("aria-pressed", String(m === "dunkel")); };
    sync();
    on($("gtHell"), "click", () => setz("hell")); on($("gtDunkel"), "click", () => setz("dunkel"));

    /* Tafeln */
    const tafeln = Array.from(kopf.querySelectorAll<HTMLElement>("nav.haupt > div"));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const zu = () => tafeln.forEach(d => { d.querySelector(".tafel")?.classList.remove("an"); d.querySelector("a")?.setAttribute("aria-expanded", "false"); });
    tafeln.forEach(d => {
      const a = d.querySelector<HTMLAnchorElement>(":scope > a"), tf = d.querySelector<HTMLElement>(".tafel"); if (!a || !tf) return;
      const auf = () => { zu(); tf.classList.add("an"); a.setAttribute("aria-expanded", "true"); };
      on(d, "mouseenter", () => { clearTimeout(timer); timer = setTimeout(auf, 120); });
      on(d, "mouseleave", () => { clearTimeout(timer); timer = setTimeout(zu, 220); });
      on(a, "click", e => { if (matchMedia("(hover:none)").matches || e.altKey) { e.preventDefault(); if (tf.classList.contains("an")) zu(); else auf(); } });
      on(a, "keydown", e => { if (e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); auf(); tf.querySelector("a")?.focus(); } });
      on(d, "focusout", e => { if (!d.contains(e.relatedTarget as Node)) zu(); });
    });
    /* Blatt */
    const blattZu = () => { blatt?.classList.remove("an"); $("burger")?.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; $("burger")?.focus(); };
    on($("burger"), "click", () => { blatt?.classList.add("an"); $("burger")?.setAttribute("aria-expanded", "true"); document.body.style.overflow = "hidden"; $("blattZu")?.focus(); });
    on($("blattZu"), "click", blattZu);
    on(document, "keydown", e => { if (e.key === "Escape") { zu(); if (blatt?.classList.contains("an")) blattZu(); } });
    /* Schwebender Kopf */
    let io: IntersectionObserver | null = null;
    if (kopf.classList.contains("schwebt")) {
      const held = document.querySelector("[data-held]");
      io = new IntersectionObserver(es => es.forEach(e => kopf.classList.toggle("gescrollt", !e.isIntersecting)), { rootMargin: "-64px 0px 0px 0px", threshold: 0 });
      if (held) io.observe(held); else kopf.classList.add("gescrollt");
    }
    return () => { ab.forEach(f => f()); io?.disconnect(); clearTimeout(timer); };
  }, []);
  return null;
}

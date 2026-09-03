"use client";
import type { ReactNode } from "react";
import { anfrageAuf, lichtAuf, zumAnker, type LichtWunsch } from "./ereignisse";

/* Auslöser im Server-Markup: ein Klick, ein Ereignis. */
export function LichtKnopf({ wunsch, className, children, tag = "button" }: { wunsch: LichtWunsch; className?: string; children: ReactNode; tag?: "button" | "figure" }) {
  if (tag === "figure") return <figure className={className} onClick={() => lichtAuf(wunsch)}>{children}</figure>;
  return <button className={className} onClick={() => lichtAuf(wunsch)}>{children}</button>;
}
export function AnfrageKnopf({ frage = false, className, children }: { frage?: boolean; className?: string; children: ReactNode }) {
  return <button className={className} onClick={() => anfrageAuf(frage)}>{children}</button>;
}
export function AnkerLink({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return <a href={`#d-${id}`} className={className} onClick={e => { e.preventDefault(); zumAnker(id); }}>{children}</a>;
}

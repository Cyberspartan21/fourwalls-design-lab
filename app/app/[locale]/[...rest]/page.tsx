import { notFound } from "next/navigation";
/* Alles, was keine bekannte Route ist, wird eine echte 404 in der Sprache. */
export default function Rest() { notFound(); }

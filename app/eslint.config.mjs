import next from "eslint-config-next";
import tseslint from "typescript-eslint";

const config = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "public/**", "scripts/**", "tests/**"]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      /* Nutzerinhalte werden nie als HTML gerendert (P5.2 §55). */
      "react/no-danger": "error",
      "@typescript-eslint/no-explicit-any": "error",
      /* Bilder bewusst ohne Framework-Optimierung: die UFER-Ausschnitte und
         <picture>-Varianten kommen aus dem Speicheranbieter (P5.2 §31). */
      "@next/next/no-img-element": "off",
      /* App Router: die Schrift steht im Wurzel-Layout und gilt überall. */
      "@next/next/no-page-custom-font": "off"
    }
  }
];
export default config;

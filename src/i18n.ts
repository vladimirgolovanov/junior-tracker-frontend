import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import manifest from "./locales/locales.json";

export interface Locale {
  code: string;
  file: string;
  name: string;
  nativeName: string;
}

// Ordered list of available languages, rendered by the language switcher.
export const locales = manifest as Locale[];

// Eagerly bundle every translation file; keyed by path (e.g. "./locales/en.json").
// locales.json is matched too but never looked up (we index by manifest `file`).
const files = import.meta.glob("./locales/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, string>>;

const resources = Object.fromEntries(
  locales.map((l) => [l.code, { translation: files[`./locales/${l.file}`] }])
);

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem("lang") || "en",
  fallbackLng: "en",
  keySeparator: false,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

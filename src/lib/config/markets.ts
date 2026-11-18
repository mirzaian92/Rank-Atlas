/**
 * Search markets. location_code / language_code values are DataForSEO's identifiers
 * (see GET /v3/dataforseo_labs/locations_and_languages — free endpoint). Verify against
 * that endpoint before adding new markets.
 */
export type Market = {
  id: string; // short id used in URLs, e.g. "us"
  country: string;
  flag: string;
  locationCode: number;
  languages: { code: string; name: string }[];
};

export const MARKETS: Market[] = [
  { id: "us", country: "United States", flag: "🇺🇸", locationCode: 2840, languages: [{ code: "en", name: "English" }, { code: "es", name: "Spanish" }] },
  { id: "uk", country: "United Kingdom", flag: "🇬🇧", locationCode: 2826, languages: [{ code: "en", name: "English" }] },
  { id: "ca", country: "Canada", flag: "🇨🇦", locationCode: 2124, languages: [{ code: "en", name: "English" }, { code: "fr", name: "French" }] },
  { id: "au", country: "Australia", flag: "🇦🇺", locationCode: 2036, languages: [{ code: "en", name: "English" }] },
  { id: "de", country: "Germany", flag: "🇩🇪", locationCode: 2276, languages: [{ code: "de", name: "German" }] },
  { id: "fr", country: "France", flag: "🇫🇷", locationCode: 2250, languages: [{ code: "fr", name: "French" }] },
  { id: "es", country: "Spain", flag: "🇪🇸", locationCode: 2724, languages: [{ code: "es", name: "Spanish" }] },
  { id: "it", country: "Italy", flag: "🇮🇹", locationCode: 2380, languages: [{ code: "it", name: "Italian" }] },
  { id: "nl", country: "Netherlands", flag: "🇳🇱", locationCode: 2528, languages: [{ code: "nl", name: "Dutch" }] },
  { id: "br", country: "Brazil", flag: "🇧🇷", locationCode: 2076, languages: [{ code: "pt", name: "Portuguese" }] },
  { id: "mx", country: "Mexico", flag: "🇲🇽", locationCode: 2484, languages: [{ code: "es", name: "Spanish" }] },
  { id: "in", country: "India", flag: "🇮🇳", locationCode: 2356, languages: [{ code: "en", name: "English" }, { code: "hi", name: "Hindi" }] },
  { id: "jp", country: "Japan", flag: "🇯🇵", locationCode: 2392, languages: [{ code: "ja", name: "Japanese" }] },
];

export const DEFAULT_MARKET = MARKETS[0];

export function getMarket(id: string | null | undefined): Market {
  return MARKETS.find((m) => m.id === id) ?? DEFAULT_MARKET;
}

export function getLanguage(market: Market, code: string | null | undefined) {
  return market.languages.find((l) => l.code === code) ?? market.languages[0];
}

export const DEVICES = [
  { id: "desktop", label: "Desktop" },
  { id: "mobile", label: "Mobile" },
] as const;
export type Device = (typeof DEVICES)[number]["id"];

import { countryByCode, countryCodesMatchingSearch } from "./countries";
import { TRIP_DESTINATION_OPTIONS } from "./travel-badges";

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
export function destinationSearchTerms(search: string) {
  const keyword = normalize(search);
  if (!keyword) return [];
  const terms = new Set([keyword]);
  for (const option of TRIP_DESTINATION_OPTIONS) {
    const aliases = [option.nameTh, option.nameEn, ...option.searchTerms].map(normalize);
    if (aliases.some(alias => alias.includes(keyword))) aliases.filter(Boolean).forEach(alias => terms.add(alias));
  }
  return [...terms];
}

type SearchableTrip = { name: string; destination: string; note?: string | null; country_code?: string | null; country_name?: string | null; trip_destinations?: Array<{nameTh?: string; nameEn?: string; countryCode?: string}> | null };
export function tripMatchesSearch(trip: SearchableTrip, search: string) {
  if (!search.trim()) return true;
  const country = countryByCode(trip.country_code || "");
  const text = normalize([trip.name, trip.destination, trip.note, trip.country_name, country?.nameTh, country?.nameEn,
    ...(country?.aliases || []), ...(trip.trip_destinations || []).flatMap(place => [place.nameTh, place.nameEn])].filter(Boolean).join(" "));
  const codes = countryCodesMatchingSearch(search);
  return destinationSearchTerms(search).some(term => text.includes(term)) || codes.includes(trip.country_code?.toUpperCase() || "") || (trip.trip_destinations || []).some(place => codes.includes(place.countryCode || ""));
}

export function canonicalTripDestination<T extends {id?: string; nameTh?: string; nameEn?: string}>(destination: T, countryCode: string) {
  const names = [destination.nameTh, destination.nameEn].filter((name): name is string => Boolean(name)).map(normalize);
  return TRIP_DESTINATION_OPTIONS.find(option => option.countryCode === countryCode &&
    (option.id.toLowerCase() === destination.id?.toLowerCase() || [option.nameTh, option.nameEn, ...option.searchTerms].some(alias => names.includes(normalize(alias))))) || destination;
}

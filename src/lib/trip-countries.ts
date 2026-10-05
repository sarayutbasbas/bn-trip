import { countryByCode } from './countries';
import { resolveTripDestinations } from './travel-badges';

// Keep country_code as the primary timezone/country for old clients. Other
// countries live with their cities in the existing trip_destinations JSON.
export function resolveMultiCountryDestinations(primary: string, ids: string[], selected?: unknown) {
  const codes = selected === undefined ? [primary] : selected;
  if (!Array.isArray(codes) || !codes.length || codes.length > 20 || codes[0] !== primary || codes.some(code => typeof code !== 'string' || !countryByCode(code))) return [];
  const places = resolveTripDestinations(codes, ids);
  if (codes.some(code => !places.some(place => place.countryCode === code))) return [];
  return places;
}

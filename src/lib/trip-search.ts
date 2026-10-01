import { countryCodesMatchingSearch } from "@/src/lib/countries";
import { destinationSearchTerms } from "./destination-search";

export function appendTripSearch(where: string[], values: Array<string | number | number[] | string[]>, search: string) {
  if (!search) return;
  values.push(destinationSearchTerms(search).map(term => `%${term.replace(/[\\%_]/g, "\\$&")}%`));
  const textIndex = values.length;
  const codes = countryCodesMatchingSearch(search);
  const patterns = `$${textIndex}::text[]`;
  const text = `t.name ILIKE ANY(${patterns}) OR t.destination ILIKE ANY(${patterns}) OR t.country_name ILIKE ANY(${patterns})
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.trip_destinations)='array' THEN t.trip_destinations ELSE '[]'::jsonb END) place
      WHERE place->>'nameTh' ILIKE ANY(${patterns}) OR place->>'nameEn' ILIKE ANY(${patterns}))`;
  if (codes.length) {
    values.push(codes);
    where.push(`(${text} OR upper(btrim(t.country_code))=ANY($${values.length}::text[]))`);
  } else where.push(`(${text})`);
}

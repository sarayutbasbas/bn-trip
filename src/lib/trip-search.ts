import { countryCodesMatchingSearch } from "@/src/lib/countries";

export function appendTripSearch(where: string[], values: Array<string | number | number[] | string[]>, search: string) {
  if (!search) return;
  values.push(`%${search}%`);
  const textIndex = values.length;
  const codes = countryCodesMatchingSearch(search);
  const text = `t.name ILIKE $${textIndex} OR t.destination ILIKE $${textIndex} OR t.country_name ILIKE $${textIndex}`;
  if (codes.length) {
    values.push(codes);
    where.push(`(${text} OR upper(btrim(t.country_code))=ANY($${values.length}::text[]))`);
  } else where.push(`(${text})`);
}

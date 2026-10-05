import assert from 'node:assert/strict';
import test from 'node:test';
import { tripDestinationRows } from '../src/lib/countries';

test('groups cities under their own flags, preserving country order', () => {
  assert.deepEqual(tripDestinationRows({country_code:'HK',trip_destinations:[
    {countryCode:'HK',nameTh:'ฮ่องกง'},
    {countryCode:'CN',nameTh:'เซินเจิ้น'},
    {countryCode:'CN',nameTh:'กวางโจว'},
    {countryCode:'CN',nameTh:'เซินเจิ้น'},
  ]}),[{code:'HK',label:'ฮ่องกง'},{code:'CN',label:'เซินเจิ้น · กวางโจว, จีน'}]);
});
test('supports legacy single-country trips and destinations without country codes', () => {
  assert.deepEqual(tripDestinationRows({country_code:'JP',destination:'Tokyo, Japan'}),[{code:'JP',label:'Tokyo, ญี่ปุ่น'}]);
  assert.deepEqual(tripDestinationRows({country_code:'JP',trip_destinations:[{nameTh:'โตเกียว'}]}),[{code:'JP',label:'โตเกียว, ญี่ปุ่น'}]);
});

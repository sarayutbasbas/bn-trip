import test from "node:test";
import assert from "node:assert/strict";
import { collectFilterMembers, matchesMemberFilter, parseMemberFilter, appendTripMemberFilter } from "../src/lib/trip-member-filter.ts";

test("multi-member filter is OR, clear means everyone", () => {
  assert.equal(matchesMemberFilter([{id:"a"}], ["a","b"]), true);
  assert.equal(matchesMemberFilter([{id:"b"}], ["a","b"]), true);
  assert.equal(matchesMemberFilter([{id:"c"}], ["a","b"]), false);
  assert.equal(matchesMemberFilter([], []), true);
});
test("member options are deduplicated across the entire collection", () => {
  const a={id:"a",display_name:"A",avatar_url:null};
  const b={id:"b",display_name:"B",avatar_url:null};
  assert.deepEqual(collectFilterMembers([{members:[a]}, {members:[b,a]}]), [a,b]);
});
test("member filter is bounded and bound in SQL for owner or collaborator", () => {
  assert.deepEqual(parseMemberFilter(" a,a,b,' OR 1=1"), ["a","b"]);
  const where:string[]=[];const values:Array<string|number|string[]|number[]>=["viewer"];
  appendTripMemberFilter(where,values,["a","b"]);
  assert.deepEqual(values,["viewer",["a","b"]]);
  assert.match(where[0],/owner_id::text=ANY\(\$2::text\[\]\)/);
  assert.match(where[0],/selected_member.user_id/);
  appendTripMemberFilter(where,values,[]);
  assert.equal(where.length,1);
});
test("omit the signed-in account only, keeping other trip owners and collaborators", () => {
  const self={id:"self",display_name:"Me",avatar_url:null};
  const otherOwner={id:"owner",display_name:"Other owner",avatar_url:null};
  assert.deepEqual(collectFilterMembers([{members:[self,otherOwner]},{members:[self]}],"self"),[otherOwner]);
  assert.deepEqual(collectFilterMembers([{members:[self]}],"self"),[]);
  assert.deepEqual(parseMemberFilter("self,owner,self","self"),["owner"]);
  assert.deepEqual(parseMemberFilter("self","self"),[]);
});

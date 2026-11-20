import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {captureCheckInPosition,checkInMapUrl,formatCheckInTimestamp} from '../shared/check-in-location.mjs';
const root=mkdtempSync(join(tmpdir(),'psspl-check-in-'));
Object.assign(process.env,{NODE_ENV:'test',CRM_DATABASE_PATH:join(root,'test.sqlite'),CRM_TEST_DATABASE_ROOT:root,CRM_DISABLE_BASELINE_RESTORE:'true'});
let db,transaction,record,createGeocoder;
before(async()=>{
  ({db,transaction}=await import('../server/db.mjs'));
  ({recordDailyCheckIn:record}=await import('../server/field-activity.mjs'));
  ({createCheckInGeocoder:createGeocoder}=await import('../server/check-in-geocoder.mjs'));
  for(const id of ['a','b'])db.prepare("INSERT INTO users(id,email,password_hash,role) VALUES(?,?,?,'rm')").run(id,id+'@test.invalid','synthetic');
});
after(()=>{db?.close();rmSync(root,{recursive:true,force:true});});
test('check-in stores original accuracy and browser timestamp; retry cannot replace coordinates',()=>{
  const capturedAt=new Date().toISOString();
  const result=record(db,transaction,'a','2026-11-20',{latitude:23.03,longitude:72.56,accuracy:15,capturedAt});
  assert.equal(result.ok,true);assert.equal(typeof result.attendanceId,'string');
  const row=db.prepare('SELECT * FROM attendance WHERE id=?').get(result.attendanceId);
  assert.equal(row.gps_accuracy_meters,15);assert.equal(row.gps_captured_at,capturedAt);
  const retry=record(db,transaction,'a','2026-11-20',{latitude:20,longitude:70,accuracy:5,capturedAt});
  assert.equal(retry.status,409);assert.equal(retry.attendanceId,result.attendanceId);
  assert.equal(db.prepare('SELECT latitude FROM attendance WHERE id=?').get(result.attendanceId).latitude,23.03);
});
test('coarse fixes require explicit consent; invalid timestamps are rejected; no-GPS remains explicit',()=>{
  assert.equal(record(db,transaction,'b','2026-11-20',{latitude:23,longitude:72,accuracy:900,capturedAt:new Date().toISOString()}).status,422);
  assert.equal(record(db,transaction,'b','2026-11-20',{latitude:23,longitude:72,accuracy:10,capturedAt:'yesterday'}).status,400);
  assert.equal(record(db,transaction,'b','2026-11-20',{latitude:23,longitude:72,accuracy:900,capturedAt:new Date().toISOString(),acceptLowAccuracy:true}).ok,true);
  const past=record(db,transaction,'a','2026-11-19',{});assert.equal(past.gpsCaptured,false);
});
const providerReply={lat:'23.03',lon:'72.56',address:{road:'Example Road',suburb:'Example Area',city:'Example City',state:'Example State',postcode:'380009'}};
test('mock geocoder persists a specific address only on the matching saved check-in and caches exact coordinates',async()=>{
  let calls=0;
  const resolve=createGeocoder(db,{endpoint:'https://geocoder.test/reverse',fetcher:async()=>{calls++;return new Response(JSON.stringify(providerReply));},spacingMs:1000});
  const row=db.prepare("SELECT * FROM attendance WHERE user_id='a' AND business_date='2026-11-20'").get();
  await resolve(row.id);
  const saved=db.prepare('SELECT * FROM attendance WHERE id=?').get(row.id);
  assert.match(saved.location_address,/Example Area/);assert.match(saved.location_address,/380009/);assert.equal(saved.location_address_status,'resolved');
  assert.equal(saved.latitude,23.03);assert.equal(saved.gps_accuracy_meters,15);
  await resolve(row.id);assert.equal(calls,1);
  const second=record(db,transaction,'a','2026-11-17',{latitude:23.03,longitude:72.56,accuracy:15,capturedAt:new Date().toISOString()});
  await resolve(second.attendanceId);assert.equal(calls,1,'a second saved record reuses the exact-coordinate cache');
  assert.equal(db.prepare("SELECT location_address FROM attendance WHERE user_id='a' AND business_date='2026-11-19'").get().location_address,null);
});
test('mock browser GPS is fresh/high-accuracy and permission/unavailable/timeout errors never produce a substitute fix',async()=>{
  const timestamp=Date.now();let calls=0;
  const position=await captureCheckInPosition({getCurrentPosition(success,failure,options){calls++;assert.deepEqual(options,{enableHighAccuracy:true,timeout:15000,maximumAge:0});success({coords:{latitude:0,longitude:0,accuracy:15},timestamp});}},()=>timestamp);
  assert.equal(calls,1);assert.equal(position.latitude,0);assert.equal(position.accuracy,15);assert.equal(position.capturedAt,new Date(timestamp).toISOString());
  for(const [code,message]of [[1,/permission was denied/],[2,/unavailable/],[3,/timed out/]])await assert.rejects(captureCheckInPosition({getCurrentPosition(success,failure){failure({code});}}),message);
  await assert.rejects(captureCheckInPosition(undefined),/unavailable/);
  await assert.rejects(captureCheckInPosition({getCurrentPosition(success){success({coords:{latitude:23,longitude:72,accuracy:10},timestamp:timestamp-300000});}},()=>timestamp),/stale/);
  const coarse=await captureCheckInPosition({getCurrentPosition(success){success({coords:{latitude:23,longitude:72,accuracy:800},timestamp});}},()=>timestamp);assert.equal(coarse.lowAccuracy,true);
});
test('plain HTTP phone access reports the HTTPS requirement without attempting a location request',async()=>{
  let calls=0;
  await assert.rejects(captureCheckInPosition({getCurrentPosition(success){calls++;success({coords:{latitude:23,longitude:72,accuracy:10},timestamp:Date.now()});}},Date.now,false),/HTTPS/);
  assert.equal(calls,0);
});
test('View Map uses exact coordinates including zero and never address search',()=>{
  const url=new URL(checkInMapUrl(23.0312345,72.5612345));assert.equal(url.searchParams.get('query'),'23.0312345,72.5612345');
  assert.equal(new URL(checkInMapUrl(0,0)).searchParams.get('query'),'0,0');assert.equal(checkInMapUrl(null,null),null);
});
test('check-in timestamps show the correct India day for UTC ISO and legacy SQLite timestamps',()=>{
  const value=formatCheckInTimestamp('2026-11-19T20:00:00Z');assert.match(value,/20 Nov 2026/);assert.match(value,/01:30/);assert.match(value,/IST/);
  assert.equal(formatCheckInTimestamp('2026-11-19 20:00:00'),value);assert.equal(formatCheckInTimestamp(null),'Timestamp unavailable');
});
test('malformed or remote geocoder features cannot invent a resolved precise address',async()=>{
  const {formatGeocodedAddress}=await import('../server/check-in-geocoder.mjs');
  assert.equal(formatGeocodedAddress({address:{city:'Unverified city'}},23.03,72.56),null);
  assert.equal(formatGeocodedAddress({lat:'999',lon:'72',address:{city:'Bad city'}},23.03,72.56),null);
  assert.equal(formatGeocodedAddress({lat:'12',lon:'45',address:{road:'Far road',city:'Wrong city'}},23.03,72.56),null);
  assert.equal(formatGeocodedAddress(providerReply,23.03,72.56,800),'Example City, Example State','low-quality GPS never claims a specific road');
  assert.match(formatGeocodedAddress({lat:'23.03',lon:'72.56',address:{amenity:'Mock landmark',city:'Mock city'}},23.03,72.56,15),/Mock landmark/,'use a nearby reported landmark when no road is provided');
});
test('API startup recovers only recorded pending jobs without backfilling legacy historical locations',async()=>{
  const {createCheckInRouter}=await import('../server/check-in-routes.mjs');
  const pending=record(db,transaction,'a','2026-11-14',{latitude:26,longitude:75,accuracy:10,capturedAt:new Date().toISOString()});
  db.exec("INSERT INTO attendance(id,user_id,business_date,check_in_at,latitude,longitude) VALUES('legacy-no-geocode','a','2026-10-01','2026-10-01T09:00:00Z',10,20)");
  const queued=[];createCheckInRouter({buildSalesDay:async()=>({}),resolveAddress:async id=>{queued.push(id);}});
  assert.ok(queued.includes(pending.attendanceId));assert.equal(queued.includes('legacy-no-geocode'),false);
});
test('simultaneous mocked geocoding lookups are serialized and provider starts are spaced',async()=>{
  const ids=['a','b'].map((id,index)=>record(db,transaction,id,'2026-11-15',{latitude:23+index,longitude:72+index,accuracy:10,capturedAt:new Date().toISOString()}).attendanceId);
  const starts=[];
  const resolve=createGeocoder(db,{endpoint:'https://rate-test.invalid/reverse',fetcher:async url=>{starts.push(Date.now());const query=new URL(url).searchParams;return new Response(JSON.stringify({lat:query.get('lat'),lon:query.get('lon'),address:{city:'Mock city',state:'Mock state'}}));}});
  await Promise.all(ids.map(resolve));assert.equal(starts.length,2);assert.ok(starts[1]-starts[0]>=950,'provider start spacing is at least approximately one second');
});
test('later movement and address resolution do not replace a historical attendance point; revisions include address changes',async()=>{
  const {checkInLocations}=await import('../server/check-in-location-data.mjs');
  const {attendanceRevision}=await import('../server/attendance-revision.mjs');
  db.prepare("INSERT INTO location_pings(id,user_id,latitude,longitude,accuracy) VALUES('later','a',10,20,1)").run();
  const current=checkInLocations(db,'2026-11-20').find(p=>p.userId==='a');assert.equal(current.latitude,23.03);assert.equal(current.gpsAccuracyMeters,15);
  const before=attendanceRevision(db,'2026-11-20');db.exec("UPDATE attendance SET location_address='Mock corrected address' WHERE user_id='a' AND business_date='2026-11-20'");assert.notEqual(attendanceRevision(db,'2026-11-20'),before);
  assert.equal(checkInLocations(db,'2026-11-17').find(p=>p.userId==='a').latitude,23.03);
});
test('provider failure preserves coordinates and reports unavailable; public endpoint is never used',async()=>{
  const row=record(db,transaction,'b','2026-11-19',{latitude:24,longitude:73,accuracy:10,capturedAt:new Date().toISOString()});
  let calls=0;const resolve=createGeocoder(db,{endpoint:'https://geocoder.test/reverse',fetcher:async()=>{calls++;throw Error('mock network failure');}});
  await resolve(row.attendanceId);const saved=db.prepare('SELECT * FROM attendance WHERE id=?').get(row.attendanceId);
  assert.equal(saved.latitude,24);assert.equal(saved.location_address,null);assert.equal(saved.location_address_status,'unavailable');assert.equal(calls,1);
  const disabled=record(db,transaction,'b','2026-11-18',{latitude:25,longitude:74,accuracy:10,capturedAt:new Date().toISOString()});
  let publicCalls=0;
  await createGeocoder(db,{endpoint:'https://nominatim.openstreetmap.org./reverse',fetcher:async()=>{publicCalls++;throw Error('must not send employee GPS');}})(disabled.attendanceId);
  assert.equal(publicCalls,0);
  assert.equal(db.prepare('SELECT location_address_status FROM attendance WHERE id=?').get(disabled.attendanceId).location_address_status,'unavailable');
});

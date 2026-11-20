import {createHash} from 'node:crypto';

const text = value => typeof value==='string' ? value.trim().slice(0,200) : '';
export function formatGeocodedAddress(result, latitude, longitude, accuracy = null) {
  const address = result?.address;
  if (!address || typeof address!=='object') return null;
  if(result.lat==null||result.lon==null||result.lat===''||result.lon==='')return null;
  const lat=Number(result.lat),lon=Number(result.lon);
  if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)return null;
  const radians=x=>x*Math.PI/180;
  const dLat=radians(lat-latitude),dLon=radians(lon-longitude);
  const hav=Math.sin(dLat/2)**2+Math.cos(radians(latitude))*Math.cos(radians(lat))*Math.sin(dLon/2)**2;
  const distance=6371000*2*Math.asin(Math.min(1,Math.sqrt(hav)));
  if (distance>5000) return null;
  // A nearest-object result is not proof of a road when the feature is far away.
  const precise=Number.isFinite(accuracy)&&accuracy<=100;
  const locality=precise&&distance<=1000?text(address.neighbourhood||address.suburb||address.quarter||address.village):'';
  const road=precise&&distance<=100?text(address.road||address.pedestrian||address.residential||address.footway||address.amenity||address.building||address.shop||address.tourism):'';
  const city=text(address.city||address.town||address.municipality||address.village||address.county);
  const parts=[locality,road,city,text(address.state),precise&&distance<=1000?text(address.postcode):''].filter(Boolean);
  return [...new Set(parts)].join(', ').slice(0,800)||null;
}

/** Only explicitly approved/self-hosted Nominatim-compatible services receive GPS. */
export function createCheckInGeocoder(database, {endpoint=process.env.CRM_REVERSE_GEOCODE_URL,fetcher=fetch,spacingMs=Number(process.env.CRM_GEOCODE_INTERVAL_MS)||1000,userAgent=process.env.CRM_GEOCODE_USER_AGENT||'PSSPL-CRM/0.2 (user-initiated check-in)'}={}) {
  let provider;
  try { provider=new URL(endpoint); if(!['https:','http:'].includes(provider.protocol)||provider.username||provider.password||provider.hostname.replace(/\.+$/,'')==='nominatim.openstreetmap.org')provider=null; } catch { provider=null; }
  const interval=Math.max(1000,spacingMs);
  let tail=Promise.resolve();
  const inFlight=new Map();
  async function resolve(id) {
    const row=database.prepare('SELECT * FROM attendance WHERE id=?').get(id);
    if(!row || row.latitude===null || row.longitude===null || row.location_address_status!=='pending')return;
    const save=address=>database.prepare("UPDATE attendance SET location_address=?,location_address_status=?,location_address_provider=?,location_address_resolved_at=? WHERE id=? AND latitude=? AND longitude=? AND location_address_status='pending'")
      .run(address,address?'resolved':'unavailable',address?'OpenStreetMap / Nominatim':null,new Date().toISOString(),id,row.latitude,row.longitude);
    if(!provider){save(null);return;}
    const url=new URL(provider);url.searchParams.set('format','jsonv2');url.searchParams.set('addressdetails','1');url.searchParams.set('lat',String(row.latitude));url.searchParams.set('lon',String(row.longitude));url.searchParams.set('accept-language','en');url.searchParams.set('zoom','18');
    const key=createHash('sha256').update(JSON.stringify([url.href,row.gps_accuracy_meters!=null&&row.gps_accuracy_meters<=100?'precise':'coarse'])).digest('hex');
    const cached=database.prepare('SELECT address FROM check_in_geocode_cache WHERE cache_key=? AND expires_at_ms>?').get(key,Date.now());
    if(cached){save(cached.address);return;}
    const slot=database.prepare(`INSERT INTO check_in_geocode_rate(provider,next_start_ms) VALUES(?,?)
      ON CONFLICT(provider) DO UPDATE SET next_start_ms=MAX(next_start_ms,?)+? RETURNING next_start_ms`).get(provider.href,Date.now()+interval,Date.now(),interval).next_start_ms-interval;
    if(slot>Date.now())await new Promise(resolve=>setTimeout(resolve,slot-Date.now()));
    let address=null;
    try{
      const response=await fetcher(url.href,{headers:{'User-Agent':userAgent,Accept:'application/json'},signal:AbortSignal.timeout(8000),redirect:'error'});
      if(response.ok)address=formatGeocodedAddress(await response.json(),row.latitude,row.longitude,row.gps_accuracy_meters);
      if(response.status===429){
        const retry=response.headers.get('retry-after');
        const requested=retry ? (Number.isFinite(Number(retry))?Date.now()+Number(retry)*1000:Date.parse(retry)) : 0;
        database.prepare('UPDATE check_in_geocode_rate SET next_start_ms=MAX(next_start_ms,?) WHERE provider=?').run(Math.max(Date.now()+60000,Number.isFinite(requested)?requested:0),provider.href);
      }
    }catch{ /* Never discard original GPS or expose precise coordinates in logs. */ }
    database.prepare('INSERT INTO check_in_geocode_cache(cache_key,address,expires_at_ms) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET address=excluded.address,expires_at_ms=excluded.expires_at_ms').run(key,address,Date.now()+(address?30*86400000:600000));
    save(address);
  }
  return id=>{
    if(inFlight.has(id))return inFlight.get(id);
    const work=tail.then(()=>resolve(id));tail=work.catch(()=>{});inFlight.set(id,work);
    void work.finally(()=>inFlight.delete(id)).catch(()=>{});
    return work;
  };
}

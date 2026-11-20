export const LOW_ACCURACY_METERS = 100;
export function formatCheckInTimestamp(value) {
  if(typeof value!=='string'||!value)return 'Timestamp unavailable';
  const utc=/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)?value.replace(' ','T')+'Z':value;
  const date=new Date(utc);
  return Number.isFinite(date.getTime())?date.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' IST':'Timestamp unavailable';
}
export function checkInMapUrl(latitude,longitude) {
  if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

/** Called by an explicit user action only; never starts a position watch. */
export function captureCheckInPosition(geolocation, now = Date.now, secureContext = globalThis.isSecureContext) {
  if (secureContext === false) return Promise.reject(new Error('GPS requires HTTPS on this device. Open the CRM using a trusted HTTPS URL; a plain HTTP LAN address cannot access location.'));
  if (!geolocation) return Promise.reject(new Error('GPS is unavailable. Use a supported browser over HTTPS, or explicitly check in without GPS.'));
  return new Promise((resolve, reject) => geolocation.getCurrentPosition(position => {
    const {latitude,longitude,accuracy} = position.coords;
    const timestamp = position.timestamp;
    if (!Number.isFinite(latitude) || Math.abs(latitude)>90 || !Number.isFinite(longitude) || Math.abs(longitude)>180 || !Number.isFinite(accuracy) || accuracy<0 || !Number.isFinite(timestamp) || Math.abs(now()-timestamp)>120000) {
      reject(new Error('GPS returned an invalid or stale fix. Retry location capture.')); return;
    }
    resolve({latitude,longitude,accuracy,capturedAt:new Date(timestamp).toISOString(),lowAccuracy:accuracy>LOW_ACCURACY_METERS});
  }, error => {
    const messages = {1:'Location permission was denied. Enable location permission in browser settings and retry.',2:'GPS is unavailable. Check device Location Services and retry.',3:'GPS timed out. Move near a window or outdoors and retry.'};
    reject(new Error(messages[error.code] || 'Location could not be captured. Retry GPS or explicitly check in without GPS.'));
  }, {enableHighAccuracy:true,timeout:15000,maximumAge:0}));
}

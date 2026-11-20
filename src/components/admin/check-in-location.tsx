import {checkInMapUrl,formatCheckInTimestamp} from '../../../shared/check-in-location.mjs';

export interface CheckInLocationData {
  latitude:number|null; longitude:number|null; checkInAt?:string|null;
  gpsAccuracyMeters?:number|null; gpsCapturedAt?:string|null;
  locationAddress?:string|null; locationAddressStatus?:string|null; locationAddressProvider?:string|null;
}
export function CheckInLocation({location,showTime=true}:{location:CheckInLocationData;showTime?:boolean}) {
  const url=checkInMapUrl(location.latitude,location.longitude);
  return <div style={{overflowWrap:'anywhere'}}>
    {showTime&&location.checkInAt&&<small>Check-in: {formatCheckInTimestamp(location.checkInAt)}</small>}
    <small>{!url?'GPS not captured':location.locationAddress || (location.locationAddressStatus==='pending'?'Resolving address…':'Address unavailable')}</small>
    {url&&<><small>GPS accuracy: {location.gpsAccuracyMeters==null?'Unavailable':`±${Math.round(location.gpsAccuracyMeters)} meters${location.gpsAccuracyMeters>100?' (low accuracy)':''}`}</small>
      {location.gpsCapturedAt&&<small>GPS captured: {formatCheckInTimestamp(location.gpsCapturedAt)}</small>}
      <a href={url} target="_blank" rel="noopener noreferrer" title="Open the original captured GPS coordinates">View Map</a>
      {location.locationAddress&&<small title="Reverse-geocoded address is approximate; the map uses the original GPS point.">Address: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></small>}
    </>}
  </div>;
}

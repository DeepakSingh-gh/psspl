export const LOW_ACCURACY_METERS: number;
export function formatCheckInTimestamp(value:string|null|undefined):string;
export function checkInMapUrl(latitude:number|null|undefined,longitude:number|null|undefined):string|null;
export interface CheckInPosition { latitude:number; longitude:number; accuracy:number; capturedAt:string; lowAccuracy:boolean; }
export function captureCheckInPosition(geolocation?: Geolocation, now?:()=>number, secureContext?:boolean):Promise<CheckInPosition>;

import {Router} from 'express';
import {authenticate,requireRole} from './auth.mjs';
import {db,transaction} from './db.mjs';
import {recordDailyCheckIn,indiaBusinessDate} from './field-activity.mjs';
import {createCheckInGeocoder} from './check-in-geocoder.mjs';

export function createCheckInRouter({buildSalesDay,resolveAddress=createCheckInGeocoder(db)}) {
  const router=Router();
  // Recover only jobs explicitly recorded by a prior user check-in; never
  // backfill legacy attendance or recapture GPS when the API restarts.
  for(const row of db.prepare("SELECT id FROM attendance WHERE location_address_status='pending' AND latitude IS NOT NULL AND longitude IS NOT NULL").all())void resolveAddress(row.id).catch(()=>{});
  router.post('/check-in',authenticate,requireRole('rm','salesperson'),async(req,res,next)=>{
    try{
      const saved=recordDailyCheckIn(db,transaction,req.user.id,indiaBusinessDate(),req.body);
      if(!saved.ok)return res.status(saved.status).json({error:saved.error,attendanceId:saved.attendanceId});
      // Check-in commits first; an unavailable provider cannot undo GPS evidence.
      if(saved.gpsCaptured)void resolveAddress(saved.attendanceId).catch(()=>{});
      res.json(await buildSalesDay(req.user.id));
    }catch(error){next(error);}
  });
  return router;
}

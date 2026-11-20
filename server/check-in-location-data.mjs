/** Original attendance evidence, never the employee's latest movement ping. */
export function checkInLocations(database,businessDate) {
  return database.prepare(`SELECT u.id userId,u.email,COALESCE(p.full_name,u.email) fullName,p.region,p.territory,
    a.id attendanceId,a.business_date businessDate,a.check_in_at checkInAt,a.check_out_at checkOutAt,a.latitude,a.longitude,
    a.gps_accuracy_meters gpsAccuracyMeters,a.gps_captured_at gpsCapturedAt,a.location_address locationAddress,
    a.location_address_status locationAddressStatus,a.location_address_provider locationAddressProvider,
    COALESCE(a.gps_captured_at,a.check_in_at) lastLocationAt
    FROM users u LEFT JOIN salesperson_profiles p ON p.user_id=u.id
    LEFT JOIN attendance a ON a.user_id=u.id AND a.business_date=?
    WHERE u.active=1 AND u.role IN ('salesperson','rm') ORDER BY p.full_name,u.email`).all(businessDate);
}

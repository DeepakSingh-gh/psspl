"use client";

import { adminApi } from "./api";
import { createAttendanceMonitor } from "./attendance-monitor";

export const subscribeAdminAttendance = createAttendanceMonitor(
  (signal) => adminApi.attendanceRevision(signal),
  {
    visible: () => document.visibilityState === "visible",
    schedule: (callback, ms) => setTimeout(callback, ms),
    cancel: (timer) => clearTimeout(timer),
    onResume: (callback) => {
      window.addEventListener("focus", callback);
      window.addEventListener("online", callback);
      document.addEventListener("visibilitychange", callback);
      return () => {
        window.removeEventListener("focus", callback);
        window.removeEventListener("online", callback);
        document.removeEventListener("visibilitychange", callback);
      };
    },
  },
);

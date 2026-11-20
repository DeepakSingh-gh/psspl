"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckInLocation, type CheckInLocationData } from "./check-in-location";
import { checkInMapUrl, formatCheckInTimestamp } from "../../../shared/check-in-location.mjs";
import "leaflet/dist/leaflet.css";

export interface MappedSalesperson extends CheckInLocationData {
  userId: string;
  fullName: string;
  email: string;
  region: string | null;
  territory: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  latitude: number | null;
  longitude: number | null;
  lastLocationAt: string | null;
}

type Status = "live" | "done" | "idle";

const statusOf = (person: MappedSalesperson): Status =>
  person.checkOutAt ? "done" : person.checkInAt ? "live" : "idle";

const STATUS_LABEL: Record<Status, string> = {
  live: "In field",
  done: "Checked out",
  idle: "Not checked in",
};

/** Centre of India — used only when nobody has sent a location yet. */
const FALLBACK_CENTRE: [number, number] = [22.9734, 78.6569];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] as string));
}

/**
 * Live positions of the sales team on a real map.
 *
 * Leaflet touches `window`, so it is imported inside an effect rather than at
 * module scope — this component renders on the client only.
 */
export function SalespersonMap({ people }: { people: MappedSalesperson[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Leaflet has no types until the dynamic import resolves, so these stay loose.
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const located = people.filter((person) => person.latitude !== null && person.longitude !== null);

  useEffect(() => {
    let cancelled = false;

    import("leaflet")
      .then((module) => {
        const L = module.default ?? module;
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
          center: FALLBACK_CENTRE,
          zoom: 4,
          scrollWheelZoom: false,
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).on("tileerror", () => { if (!cancelled) setFailed(true); }).addTo(map);

        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
        setReady(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; layerRef.current = null; }
    };
  }, []);

  // Redraw markers whenever the roster or its positions change.
  useEffect(() => {
    if (!ready || !mapRef.current || !layerRef.current) return;
    let cancelled = false;

    import("leaflet").then((module) => {
      const L = module.default ?? module;
      if (cancelled || !layerRef.current) return;
      layerRef.current.clearLayers();

      if (!located.length) {
        mapRef.current.setView(FALLBACK_CENTRE, 4);
        return;
      }

      for (const person of located) {
        const status = statusOf(person);
        const marker = L.marker([person.latitude as number, person.longitude as number], {
          title: person.fullName,
          icon: L.divIcon({
            className: "",
            html: `<span class="map-pin is-${status}">${escapeHtml(person.fullName.slice(0, 1).toUpperCase())}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -14],
          }),
        });

        marker.bindPopup(`
          <div class="map-popup">
            <strong>${escapeHtml(person.fullName)}</strong>
            <span>${escapeHtml(person.territory || person.region || "Territory not assigned")}</span>
            <em class="is-${status}">${STATUS_LABEL[status]}</em>
            <small>${escapeHtml(formatCheckInTimestamp(person.checkInAt))}</small>
            <small>${escapeHtml(person.locationAddress || (person.locationAddressStatus === 'pending' ? 'Resolving address…' : 'Address unavailable'))}</small>
            <small>GPS accuracy: ${person.gpsAccuracyMeters == null ? 'Unavailable' : '±'+Math.round(person.gpsAccuracyMeters)+' m'}</small>
            <a target="_blank" rel="noopener noreferrer" href="${checkInMapUrl(person.latitude,person.longitude)}">View Map</a>
          </div>
        `);

        marker.addTo(layerRef.current);
      }

      const bounds = L.latLngBounds(located.map((person) => [person.latitude as number, person.longitude as number]));
      mapRef.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
    });

    return () => { cancelled = true; };
    // `located` is derived from `people` each render, so track the source instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, people]);

  const counts = {
    live: people.filter((person) => statusOf(person) === "live").length,
    done: people.filter((person) => statusOf(person) === "done").length,
    idle: people.filter((person) => statusOf(person) === "idle").length,
  };

  return (
    <div className="teammap">
      <div className="teammap-head">
        <div>
          <p className="teammap-eyebrow">Check-in locations</p>
          <h2>Where the team checked in</h2>
        </div>
        <div className="teammap-legend">
          <span><i className="is-live" />{counts.live} in field</span>
          <span><i className="is-done" />{counts.done} checked out</span>
          <span><i className="is-idle" />{counts.idle} not checked in</span>
          <Link href="/admin/activity">Routes →</Link>
        </div>
      </div>

      <div className="teammap-canvas">
        <div ref={containerRef} className="teammap-surface" role="application" aria-label="Map of salesperson locations" />

        {!ready && !failed && located.length > 0 && <div className="teammap-overlay"><strong>Loading map?</strong></div>}
        {failed && (
          <div className="teammap-overlay">
            <strong>Map could not be loaded</strong>
            <span>The map tiles need an internet connection. The roster below still works.</span>
          </div>
        )}

        {!failed && !located.length && (
          <div className="teammap-overlay">
            <strong>No locations captured today</strong>
            <span>Salespeople appear here as soon as they check in with location enabled on the mobile app.</span>
          </div>
        )}
      </div>

      <div className="teammap-roster">
        {people.map((person) => {
          const status = statusOf(person);
          return (
            <div key={person.userId} className="teammap-person">
              <i className={`is-${status}`} aria-hidden="true" />
              <div>
                <strong>{person.fullName}</strong>
                <small>{person.territory || person.region || "Territory not assigned"}</small>
              </div>
              <div className="teammap-person-state">
                <span className={`is-${status}`}>{STATUS_LABEL[status]}</span>
              </div>
              <div style={{gridColumn:'2 / -1',minWidth:0}}><CheckInLocation location={person} /></div>
            </div>
          );
        })}
        {!people.length && <p className="teammap-empty">No active salesperson accounts.</p>}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { AdvancedMarker, APIProvider, Map } from "@vis.gl/react-google-maps";
import { NavigationIcon } from "@/components/ui";
import { formatDistance, home, mapsUrl } from "@/lib/pharmacies";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
// Advanced markers need a Map ID. DEMO_MAP_ID is Google's ready-made one.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export interface MapPlace {
  name: string;
  address: string;
  distanceKm: number;
  lat: number;
  lng: number;
}

function bounds(points: { lat: number; lng: number }[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
    // Extra room on the right for the zoom buttons.
    padding: { top: 36, bottom: 36, left: 36, right: 72 },
  };
}

/**
 * Interactive Google map (Maps JavaScript API): the patient's home and numbered pins that
 * match the list below it. Tapping a pin shows its name, distance and the route link.
 * Renders nothing when NEXT_PUBLIC_GOOGLE_MAPS_KEY is not set.
 */
export function PlacesMap({ places, homeLabel }: { places: MapPlace[]; homeLabel: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!KEY || places.length === 0) return null;

  const shown = places.slice(0, 9);
  const current = selected === null ? null : shown[selected];

  return (
    <figure className="flex flex-col gap-2">
      <APIProvider apiKey={KEY} language="pt-BR" region="BR">
        <div className="aspect-square w-full overflow-hidden rounded-card border border-line-soft bg-surface">
          <Map
            mapId={MAP_ID}
            defaultBounds={bounds([home, ...shown])}
            gestureHandling="cooperative"
            disableDefaultUI
            zoomControl
            clickableIcons={false}
            onClick={() => setSelected(null)}
          >
            <AdvancedMarker position={home} title={homeLabel} zIndex={1}>
              <span className="flex size-8 items-center justify-center rounded-full border-[3px] border-white bg-brand text-[14px] font-extrabold text-white shadow-md">
                C
              </span>
            </AdvancedMarker>
            {shown.map((p, i) => (
              <AdvancedMarker
                key={`${p.lat},${p.lng}`}
                position={p}
                title={p.name}
                zIndex={selected === i ? 30 : 10}
                onClick={() => setSelected(i)}
              >
                <span
                  className={`flex items-center justify-center rounded-full border-[3px] border-white font-extrabold text-white shadow-md ${
                    selected === i ? "size-10 bg-ink text-[16px]" : "size-8 bg-danger text-[14px]"
                  }`}
                >
                  {i + 1}
                </span>
              </AdvancedMarker>
            ))}
          </Map>
        </div>
      </APIProvider>

      {current ? (
        <div className="flex items-center justify-between gap-3 rounded-card border border-line-soft bg-surface px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <b className="leading-snug">
              {(selected ?? 0) + 1}. {current.name}
            </b>
            <span className="text-[15px] text-muted">
              {formatDistance(current.distanceKm)} da casa. {current.address}
            </span>
          </div>
          <a
            href={mapsUrl(current)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Como chegar em ${current.name}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-ink text-ink"
          >
            <NavigationIcon size={20} />
          </a>
        </div>
      ) : (
        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
              C
            </span>
            {homeLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-danger text-[11px] font-bold text-white">
              1
            </span>
            Toque no número para ver
          </span>
        </figcaption>
      )}
    </figure>
  );
}

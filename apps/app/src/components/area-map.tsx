/** Radius around home where the app looks for pharmacies and health posts. */
export const SEARCH_RADIUS_KM = 2;

const ZOOM = 12;
const TILE = 256;

/** Web Mercator pixel of a point at ZOOM. */
function pixel(lat: number, lng: number) {
  const scale = TILE * 2 ** ZOOM;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

/**
 * Thin map strip of the area around a point, with the search circle. No marker: the point is only
 * the street of the CEP. OpenStreetMap tiles, toned down, no key needed.
 */
export function AreaMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const c = pixel(lat, lng);
  const metersPerPixel = (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** ZOOM;
  const r = (SEARCH_RADIUS_KM * 1000) / metersPerPixel;
  const tx = Math.floor(c.x / TILE);
  const ty = Math.floor(c.y / TILE);
  const tiles: { x: number; y: number }[] = [];
  for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) tiles.push({ x: tx + dx, y: ty + dy });

  return (
    <figure className="flex flex-col gap-1.5">
      <div
        role="img"
        aria-label={`Mapa da região de ${label}, com um círculo de ${SEARCH_RADIUS_KM} km`}
        className="relative h-[120px] w-full overflow-hidden rounded-2xl border border-line-soft bg-cream"
      >
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${t.x}-${t.y}`}
            src={`https://tile.openstreetmap.org/${ZOOM}/${t.x}/${t.y}.png`}
            alt=""
            width={TILE}
            height={TILE}
            className="absolute max-w-none saturate-[0.35]"
            style={{ left: `calc(50% + ${t.x * TILE - c.x}px)`, top: `calc(50% + ${t.y * TILE - c.y}px)` }}
          />
        ))}
        <span
          aria-hidden="true"
          className="absolute rounded-full border-2 border-accent bg-accent/15"
          style={{ width: r * 2, height: r * 2, left: `calc(50% - ${r}px)`, top: `calc(50% - ${r}px)` }}
        />
        <span className="absolute bottom-1 right-1.5 rounded bg-white/80 px-1 text-[10px] text-muted">
          © OpenStreetMap
        </span>
      </div>
      <figcaption className="text-[14px] text-muted">
        Procuramos farmácias e postos de saúde até {SEARCH_RADIUS_KM} km daqui.
      </figcaption>
    </figure>
  );
}

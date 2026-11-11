import { home } from "@/lib/pharmacies";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

interface Place {
  lat: number;
  lng: number;
}

/**
 * Google Maps Static API image: the patient's home and numbered pins that match the list
 * below it. Renders nothing when NEXT_PUBLIC_GOOGLE_MAPS_KEY is not set.
 */
export function PlacesMap({ places, homeLabel }: { places: Place[]; homeLabel: string }) {
  if (!KEY || places.length === 0) return null;

  const params = new URLSearchParams({
    size: "640x360",
    scale: "2",
    language: "pt-BR",
    region: "BR",
    key: KEY,
  });
  params.append("markers", `color:0x0b5d57|label:C|${home.lat},${home.lng}`);
  places.slice(0, 9).forEach((p, i) => {
    params.append("markers", `color:0xa11d17|label:${i + 1}|${p.lat},${p.lng}`);
  });
  // Hide other points of interest so only our pins stand out.
  params.append("style", "feature:poi|element:labels|visibility:off");
  params.append("style", "feature:transit|visibility:off");

  return (
    <figure className="flex flex-col gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- external Google image, already sized */}
      <img
        src={`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`}
        alt={`Mapa com ${homeLabel} e os lugares numerados da lista`}
        width={640}
        height={360}
        loading="lazy"
        className="aspect-[16/9] w-full rounded-card border border-line-soft bg-surface object-cover"
      />
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
          Números da lista
        </span>
      </figcaption>
    </figure>
  );
}

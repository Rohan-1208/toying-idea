import { useState } from "react";
import { normalizeImageList } from "../lib/image-url";

export function ProductGallery({
  images,
  alt,
  rounded = "rounded-3xl",
}: {
  images: string[];
  alt: string;
  rounded?: string;
}) {
  const gallery = normalizeImageList(images);
  const [active, setActive] = useState(0);

  if (!gallery.length) return null;

  const main = gallery[active] || gallery[0];

  return (
    <>
      <div className={`aspect-square w-full overflow-hidden bg-cream-200 ${rounded}`}>
        <img src={main} alt={alt} className="h-full w-full object-cover" />
      </div>

      {gallery.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {gallery.slice(0, 8).map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => setActive(i)}
              className={`aspect-square overflow-hidden rounded-xl bg-cream-200 ring-2 transition-all ${
                active === i ? "ring-clay" : "ring-transparent hover:ring-ink/20"
              }`}
              aria-label={`Show image ${i + 1}`}
              aria-pressed={active === i}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

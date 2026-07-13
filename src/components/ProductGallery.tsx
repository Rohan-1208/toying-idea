import { useCallback, useEffect, useState } from "react";
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
  const [lightbox, setLightbox] = useState(false);

  const showPrev = useCallback(() => {
    setActive((i) => (i - 1 + gallery.length) % gallery.length);
  }, [gallery.length]);

  const showNext = useCallback(() => {
    setActive((i) => (i + 1) % gallery.length);
  }, [gallery.length]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, showPrev, showNext]);

  if (!gallery.length) return null;

  const main = gallery[active] || gallery[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setLightbox(true)}
        className={`group relative aspect-square w-full overflow-hidden bg-cream-200 ${rounded} cursor-zoom-in`}
        aria-label={`View ${alt} full size`}
      >
        <img src={main} alt={alt} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-ink/60 px-3 py-1 text-xs font-medium text-cream-50 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          Click to enlarge
        </span>
      </button>

      {gallery.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {gallery.slice(0, 8).map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => {
                setActive(i);
                setLightbox(true);
              }}
              className={`aspect-square overflow-hidden rounded-xl bg-cream-200 ring-2 transition-all ${
                active === i ? "ring-clay" : "ring-transparent hover:ring-ink/20"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/90 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Product image gallery"
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 rounded-full bg-cream/10 p-2 text-cream-50 hover:bg-cream/20"
            aria-label="Close gallery"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-cream/10 p-3 text-cream-50 hover:bg-cream/20 md:left-6"
                aria-label="Previous image"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-cream/10 p-3 text-cream-50 hover:bg-cream/20 md:right-6"
                aria-label="Next image"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
          )}

          <img
            src={main}
            alt={alt}
            className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {gallery.length > 1 && (
            <p className="absolute bottom-4 text-sm text-cream-50/70">
              {active + 1} / {gallery.length}
            </p>
          )}
        </div>
      )}
    </>
  );
}

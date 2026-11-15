import { useEffect, useState, type CSSProperties } from "react";
import { imageUrl } from "../lib/api";

interface FeedImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  accent?: string;
  fallbackLabel?: string;
  priority?: boolean;
}

export function FeedImage({
  src,
  alt = "",
  className = "",
  accent = "#b3261e",
  fallbackLabel,
  priority = false,
}: FeedImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const url = imageUrl(src);
  if (!url || failed) {
    return (
      <div
        className={`feed-image-fallback ${className}`}
        style={{ "--fallback-accent": accent } as CSSProperties}
        aria-hidden="true"
      >
        <span>{fallbackLabel ?? "阅界"}</span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={url}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      onLoad={(event) => {
        const img = event.currentTarget;
        if (img.naturalWidth < 40 || img.naturalHeight < 40) setFailed(true);
      }}
    />
  );
}

import { useState } from "react";

/** Clinical hero panel — CSS gradient always shows; image is optional enhancement. */
export function HeroBackdrop({
  children,
  className = "",
  imageSrc = "/images/hospital-lobby.png",
  imageAlt = "Clinical facility interior",
}: {
  children?: React.ReactNode;
  className?: string;
  imageSrc?: string;
  imageAlt?: string;
}) {
  const [imageOk, setImageOk] = useState(true);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(145deg, #0b2430 0%, #0a6b6f 45%, #134e4a 100%)",
        }}
        aria-hidden
      />
      {imageOk ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageOk(false)}
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, rgba(11,36,48,0.82) 10%, rgba(10,107,111,0.45) 100%)",
        }}
        aria-hidden
      />
      {children ? <div className="relative z-10 h-full">{children}</div> : null}
    </div>
  );
}

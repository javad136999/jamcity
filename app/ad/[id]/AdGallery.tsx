"use client";

import { useState } from "react";

export default function AdGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl2 glass text-4xl text-slate-300">
        🖼️
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl2 glass">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active]}
          alt={title}
          className="h-72 w-full object-cover md:h-96"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img}
              onClick={() => setActive(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl2 border-2 ${
                active === i ? "border-jam-green" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

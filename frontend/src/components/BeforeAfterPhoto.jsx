import React from 'react';

// This photo is already a side-by-side comparison. Keep its natural aspect
// ratio so neither half is cropped at narrow viewport widths.
export default function BeforeAfterPhoto({ src, alt, caption, loading = 'lazy', className = '' }) {
  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#111]">
        <img
          src={src}
          alt={alt}
          width="1448"
          height="1086"
          loading={loading}
          decoding="async"
          className="block h-auto w-full"
        />
        <span aria-hidden="true" className="absolute left-2 top-2 rounded bg-black/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white sm:left-3 sm:top-3 sm:text-xs">Before</span>
        <span aria-hidden="true" className="absolute left-1/2 top-2 ml-2 rounded bg-[#76B900] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-black sm:top-3 sm:ml-3 sm:text-xs">After</span>
      </div>
      {caption && <figcaption className="mt-3 text-xs leading-relaxed text-neutral-400">{caption}</figcaption>}
    </figure>
  );
}

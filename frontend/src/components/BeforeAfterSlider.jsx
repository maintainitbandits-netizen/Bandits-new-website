import React, { useState } from 'react';

// A single slider is shared by the gallery and the sod service page. Images can
// opt into a full-frame aspect ratio when preserving the complete comparison is
// more useful than filling the default card crop.
const BeforeAfterSlider = ({ before, after, alt, beforeAlt, afterAlt, aspectRatio = '4 / 3', imageFit = 'cover' }) => {
  const [pos, setPos] = useState(50);
  const clamp = value => Math.max(0, Math.min(100, value));
  const handleMove = (clientX, target) => {
    const rect = target.getBoundingClientRect();
    if (rect.width) setPos(clamp(((clientX - rect.left) / rect.width) * 100));
  };
  const handleKeyDown = event => {
    const increments = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -10, PageUp: 10 };
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setPos(event.key === 'Home' ? 0 : 100);
    } else if (Object.prototype.hasOwnProperty.call(increments, event.key)) {
      event.preventDefault();
      setPos(current => clamp(current + increments[event.key]));
    }
  };
  const beforeVisible = Math.round(pos);

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`${alt} comparison`}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={beforeVisible}
      aria-valuetext={`${beforeVisible}% of the before photo visible`}
      className="relative overflow-hidden rounded-xl bg-[#0a0a0a] select-none cursor-ew-resize focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-400"
      style={{ aspectRatio, touchAction: 'pan-y' }}
      onMouseMove={event => handleMove(event.clientX, event.currentTarget)}
      onTouchMove={event => handleMove(event.touches[0].clientX, event.currentTarget)}
      onClick={event => handleMove(event.clientX, event.currentTarget)}
      onKeyDown={handleKeyDown}
    >
      <img src={after} alt={afterAlt || `${alt} – after`} className="absolute inset-0 w-full h-full" style={{ objectFit: imageFit }} draggable={false} loading="lazy" />
      <img
        src={before}
        alt={beforeAlt || `${alt} – before`}
        draggable={false}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: imageFit, clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        loading="lazy"
      />
      <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${pos}%` }} aria-hidden="true">
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90" />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-white shadow-2xl grid place-items-center text-neutral-900 font-bold">↔</div>
      </div>
      <span aria-hidden="true" className="absolute top-3 left-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded-full tracking-widest uppercase z-10">Before</span>
      <span aria-hidden="true" className="absolute top-3 right-3 bg-green-500 text-[#0a0a0a] text-[10px] px-2 py-1 rounded-full tracking-widest uppercase font-bold z-10">After</span>
    </div>
  );
};

export default BeforeAfterSlider;

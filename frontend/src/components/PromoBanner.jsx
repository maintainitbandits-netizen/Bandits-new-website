import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X, ArrowRight, Leaf, Sun, Wind, Snowflake, Flower, TreePine } from 'lucide-react';

// Seasonal offers that auto-rotate by month
const SEASONAL_OFFERS = [
  // January (0)
  { icon: Snowflake, message: 'Book your Spring Cleanup early — schedule fills fast for March/April', cta: 'Reserve My Spot', link: '/services/property-maintenance', accent: 'from-blue-600 via-blue-500 to-blue-600' },
  // February (1)
  { icon: Flower, message: 'Pre-Emergent Weed Control season is here — stop weeds before they start', cta: 'Schedule Treatment', link: '/services/fertilization', accent: 'from-purple-600 via-purple-500 to-purple-600' },
  // March (2)
  { icon: Flower, message: 'Spring Cleanup Special — refresh your Austin yard for the new season', cta: 'Get Spring Quote', link: '/services/property-maintenance', accent: 'from-pink-600 via-pink-500 to-pink-600' },
  // April (3)
  { icon: Leaf, message: 'Now booking weekly mowing schedules — lock in your route spot', cta: 'Start Mowing Service', link: '/services/lawn-mowing', accent: 'from-green-600 via-green-500 to-green-600' },
  // May (4)
  { icon: Sun, message: 'Fresh sod & landscape installs — ideal time to plant in Central Texas', cta: 'Plan My Yard', link: '/services/sod-installation', accent: 'from-emerald-600 via-emerald-500 to-emerald-600' },
  // June (5)
  { icon: Sun, message: 'Summer Lawn Care — keep your grass green through Austin heat', cta: 'Beat the Heat', link: '/services/fertilization', accent: 'from-amber-600 via-amber-500 to-amber-600' },
  // July (6)
  { icon: Sun, message: 'Drought-tough landscaping installs — water-wise designs for Austin', cta: 'Save Water', link: '/services/landscaping', accent: 'from-orange-600 via-orange-500 to-orange-600' },
  // August (7)
  { icon: Sun, message: 'End of Summer Tune-Up — prep your lawn for fall recovery', cta: 'Book Tune-Up', link: '/services/fertilization', accent: 'from-yellow-600 via-yellow-500 to-yellow-600' },
  // September (8)
  { icon: Wind, message: 'Fall Aeration & Overseeding — the secret to a thick spring lawn', cta: 'Schedule Aeration', link: '/services/fertilization', accent: 'from-orange-700 via-orange-500 to-orange-700' },
  // October (9)
  { icon: TreePine, message: 'Fall Cleanup & Leaf Removal — save your lawn from winter damage', cta: 'Book Cleanup', link: '/services/property-maintenance', accent: 'from-red-600 via-red-500 to-red-600' },
  // November (10)
  { icon: TreePine, message: 'Holiday Property Prep — leaf removal, trim work, last cleanups', cta: 'Get Property Ready', link: '/services/property-maintenance', accent: 'from-red-700 via-red-500 to-red-700' },
  // December (11)
  { icon: Snowflake, message: 'Move-out & Deep Cleaning specials — perfect for end-of-year transitions', cta: 'Book Cleaning', link: '/services/cleaning', accent: 'from-blue-700 via-cyan-500 to-blue-700' },
];

const getSessionKey = (month) => `mib_seasonal_${month}_dismissed_v1`;

const PromoBanner = () => {
  const [open, setOpen] = useState(false);
  const month = new Date().getMonth();
  const offer = useMemo(() => SEASONAL_OFFERS[month], [month]);

  useEffect(() => {
    if (!sessionStorage.getItem(getSessionKey(month))) setOpen(true);
  }, [month]);

  if (!open) return null;

  const Icon = offer.icon;

  return (
    <div className={`bg-gradient-to-r ${offer.accent} text-[#0a0a0a] text-sm`}>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-2.5 flex items-center justify-center gap-3 text-center relative">
        <Icon size={14} className="hidden sm:inline flex-shrink-0"/>
        <span className="font-semibold">{offer.message}</span>
        <Link to={offer.link} className="hidden md:inline-flex items-center gap-1 font-bold hover:underline whitespace-nowrap">{offer.cta} <ArrowRight size={14}/></Link>
        <button onClick={() => { sessionStorage.setItem(getSessionKey(month), '1'); setOpen(false); }} aria-label="Dismiss" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0a0a0a]/70 hover:text-[#0a0a0a]">
          <X size={16}/>
        </button>
      </div>
    </div>
  );
};

export default PromoBanner;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X, ArrowRight } from 'lucide-react';

const KEY = 'mib_promo_dismissed_v1';

const PromoBanner = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(KEY)) setOpen(true);
  }, []);

  if (!open) return null;

  return (
    <div className="bg-gradient-to-r from-green-600 via-green-500 to-green-600 text-[#0a0a0a] text-sm">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-2.5 flex items-center justify-center gap-3 text-center relative">
        <Sparkles size={14} className="hidden sm:inline"/>
        <span className="font-semibold">New Customer Special: <span className="underline">$25 off your first service</span> — mention this banner.</span>
        <Link to="/contact" className="hidden md:inline-flex items-center gap-1 font-bold hover:underline">Claim <ArrowRight size={14}/></Link>
        <button onClick={() => { sessionStorage.setItem(KEY, '1'); setOpen(false); }} aria-label="Dismiss" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0a0a0a]/70 hover:text-[#0a0a0a]">
          <X size={16}/>
        </button>
      </div>
    </div>
  );
};

export default PromoBanner;

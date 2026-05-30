import React, { useEffect, useState } from 'react';
import { Phone, MessageSquare, X } from 'lucide-react';
import { COMPANY } from '../mock';

const StickyCallButton = () => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (dismissed) return null;

  return (
    <>
      {/* Mobile sticky bottom bar */}
      <div className={`md:hidden fixed bottom-0 inset-x-0 z-50 transition-transform ${visible ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-[#0a0a0a]/95 backdrop-blur border-t border-green-500/30 p-3 flex gap-3">
          <a href={`tel:${COMPANY.phoneRaw}`} className="btn-green flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm">
            <Phone size={16}/> Call Now
          </a>
          <a href={`sms:${COMPANY.phoneRaw}`} className="btn-dark flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm">
            <MessageSquare size={16} className="text-green-400"/> Text Us
          </a>
        </div>
      </div>

      {/* Desktop floating CTA */}
      <div className={`hidden md:flex fixed bottom-6 right-6 z-50 transition-all ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'}`}>
        <a href={`tel:${COMPANY.phoneRaw}`} className="btn-green inline-flex items-center gap-3 px-5 py-4 rounded-full font-semibold shadow-2xl shadow-green-500/30">
          <span className="h-10 w-10 rounded-full bg-[#0a0a0a]/20 grid place-items-center"><Phone size={18}/></span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[10px] uppercase tracking-widest opacity-80">Call for Free Estimate</span>
            <span className="text-base">{COMPANY.phone}</span>
          </span>
        </a>
        <button aria-label="Dismiss" onClick={() => setDismissed(true)} className="ml-2 self-start h-7 w-7 rounded-full bg-[#161616] border border-[#2a2a2a] text-neutral-400 grid place-items-center hover:text-white">
          <X size={14}/>
        </button>
      </div>
    </>
  );
};

export default StickyCallButton;

import React, { useEffect, useState } from 'react';
import { X, MessageSquare, ArrowRight, Phone } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { COMPANY } from '../mock';

const KEY = 'mib_exit_intent_dismissed';

const ExitIntent = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === '/contact' || sessionStorage.getItem(KEY)) return;
    let triggered = false;
    const handler = (e) => {
      if (triggered) return;
      // Only a real desktop pointer leaving the viewport counts as exit intent.
      // Mobile taps and movement between elements must not interrupt a visitor.
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !e.relatedTarget && e.clientY <= 0) {
        triggered = true;
        setOpen(true);
      }
    };
    const mobileTimer = setTimeout(() => {
      if (!triggered && window.innerWidth < 768) {
        triggered = true;
        setOpen(true);
      }
    }, 45000);
    document.addEventListener('mouseout', handler);
    return () => {
      document.removeEventListener('mouseout', handler);
      clearTimeout(mobileTimer);
    };
  }, [pathname]);

  const close = () => {
    sessionStorage.setItem(KEY, '1');
    setOpen(false);
  };

  if (!open || pathname === '/contact') return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-center px-4 animate-in fade-in duration-300" onClick={close}>
      <div className="bg-[#0f0f0f] border border-green-500/30 rounded-2xl max-w-md w-full p-8 relative shadow-2xl shadow-green-500/20" onClick={e => e.stopPropagation()}>
        <button onClick={close} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-[#161616] border border-[#2a2a2a] text-neutral-400 grid place-items-center hover:text-white">
          <X size={14}/>
        </button>
        <div className="h-16 w-16 rounded-full bg-green-500/15 border border-green-500/40 grid place-items-center mx-auto">
          <MessageSquare className="text-green-400" size={28}/>
        </div>
        <h3 className="font-serif text-2xl md:text-3xl text-white text-center mt-5">Have a project in mind?</h3>
        <p className="text-neutral-400 text-sm text-center mt-3">Tell us what your property needs. We&apos;ll respond within 24 hours.</p>
        <div className="flex flex-col gap-3 mt-6">
          <Link to="/contact" onClick={close} className="btn-green inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold">Request a Quote <ArrowRight size={16}/></Link>
          <a href={`tel:${COMPANY.phoneRaw}`} onClick={close} className="btn-dark inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold"><Phone size={16} className="text-green-400"/> Call {COMPANY.phone}</a>
        </div>
      </div>
    </div>
  );
};

export default ExitIntent;

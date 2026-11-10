import React from 'react';
import { ArrowRight, Calendar, CheckCircle2, Download } from 'lucide-react';

const LeadMagnet = () => (
  <section className="py-24 bg-[#080808]">
    <div className="max-w-5xl mx-auto px-5 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-center bg-[#0f0f0f] border border-green-500/20 rounded-3xl p-6 sm:p-8 md:p-12">
        <div className="lg:col-span-3">
          <div className="inline-flex items-center gap-2 chip px-3 py-1 rounded-full text-xs tracking-widest font-medium uppercase"><Download size={12}/> Free Guide</div>
          <h2 className="font-serif text-3xl md:text-5xl text-white mt-5 leading-tight">The Austin Lawn Care Calendar</h2>
          <p className="text-neutral-300 mt-4 leading-relaxed">A practical month-by-month guide for Bermuda, St. Augustine and Zoysia lawns in Central Texas. Adjust tasks for your grass, the weather and current watering rules.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {['A checklist for every month', 'Mowing and warm-season lawn care basics', 'Water-wise reminders and local resources', 'Seasonal planning for your property'].map(item => (
              <li key={item} className="flex items-start gap-2 text-neutral-200"><CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0"/> {item}</li>
            ))}
          </ul>
          <div className="mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <a href="/guides/austin-lawn-care-calendar.pdf" download className="btn-green inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold">
              Download Free Calendar <Download size={16}/>
            </a>
            <a href="/guides/austin-lawn-care-calendar.html" className="btn-dark inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold">
              Read Online <ArrowRight size={16}/>
            </a>
          </div>
          <p className="text-neutral-500 text-xs mt-3">Instant PDF download. No email address required.</p>
        </div>
        <div className="lg:col-span-2 flex justify-center">
          <div className="relative w-full max-w-[16rem]">
            <div className="absolute -inset-3 bg-green-500/10 rounded-3xl blur-xl"/>
            <div className="relative bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-8 shadow-2xl w-full aspect-[3/4] flex flex-col justify-between border border-green-500/40">
              <div>
                <Calendar className="text-white/80" size={32}/>
                <div className="text-white text-xs uppercase tracking-widest mt-4 opacity-80">Free Guide</div>
                <h3 className="text-white font-serif text-2xl mt-2 leading-tight">Austin Lawn Care Calendar</h3>
              </div>
              <div>
                <div className="text-white/60 text-xs">12 Months · Printable PDF</div>
                <div className="text-white font-bold mt-1">Maintain It Bandits</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default LeadMagnet;

import React from 'react';
import { Phone, ClipboardCheck, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    icon: Phone,
    title: 'Request a Free Quote',
    text: 'Tell us what you need in 60 seconds online or call us. We respond within 24 hours — usually much sooner.',
  },
  {
    icon: ClipboardCheck,
    title: 'Schedule Your Service',
    text: 'Approve the quote and pick a date. Most jobs can start the same week. No deposits required.',
  },
  {
    icon: Sparkles,
    title: 'Enjoy the Results',
    text: 'Our team handles everything start to finish. Sit back, relax, and watch your property transform.',
  },
];

const HowItWorks = () => (
  <section className="py-24 bg-[#080808]">
    <div className="max-w-6xl mx-auto px-5 lg:px-8">
      <div className="text-center mb-14">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">How It Works</span>
        <h2 className="font-serif text-4xl md:text-5xl text-white mt-5">Easy as 1 – 2 – 3</h2>
        <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">No pressure. No surprises. No long-term contracts. Just professional home services done right.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {STEPS.map((s, i) => (
          <div key={i} className="relative bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7 hover:border-green-500/40 transition-colors">
            <div className="absolute -top-4 left-7 bg-green-500 text-[#0a0a0a] h-8 w-8 rounded-full grid place-items-center font-bold text-sm shadow-lg">{i + 1}</div>
            <div className="h-12 w-12 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center mt-2">
              <s.icon className="text-green-400" size={22}/>
            </div>
            <h3 className="text-white font-semibold text-xl mt-5">{s.title}</h3>
            <p className="text-neutral-400 text-sm mt-3 leading-relaxed">{s.text}</p>
          </div>
        ))}
      </div>

      <div className="text-center mt-10">
        <Link to="/contact" className="btn-green inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold">Start Step 1 – Get Free Quote <ArrowRight size={16}/></Link>
      </div>
    </div>
  </section>
);

export default HowItWorks;

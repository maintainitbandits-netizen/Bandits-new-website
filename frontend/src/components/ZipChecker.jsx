import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { SERVICE_AREAS_DETAIL } from '../seo';

// Flatten all ZIPs into a lookup
const ALL_ZIPS = {};
Object.entries(SERVICE_AREAS_DETAIL).forEach(([slug, area]) => {
  area.zips.forEach(z => { ALL_ZIPS[z] = { slug, name: area.fullName }; });
});

const ZipChecker = () => {
  const [zip, setZip] = useState('');
  const [result, setResult] = useState(null);

  const check = (e) => {
    e.preventDefault();
    const clean = zip.trim().slice(0, 5);
    if (!/^\d{5}$/.test(clean)) {
      setResult({ ok: false, message: 'Please enter a valid 5-digit ZIP code.' });
      return;
    }
    const match = ALL_ZIPS[clean];
    if (match) {
      setResult({ ok: true, name: match.name, slug: match.slug });
    } else {
      setResult({ ok: false, message: 'Your ZIP isn\u2019t in our standard service area \u2014 but call us! We often service nearby ZIPs too.', notListed: true });
    }
  };

  return (
    <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-3xl p-7 md:p-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-full bg-green-500/15 border border-green-500/40 grid place-items-center"><Search className="text-green-400" size={22}/></div>
        <div>
          <h3 className="font-serif text-2xl md:text-3xl text-white">Do We Service Your Area?</h3>
          <p className="text-neutral-400 text-sm mt-1">Enter your ZIP code to check coverage — instant answer.</p>
        </div>
      </div>

      <form onSubmit={check} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter your ZIP code (e.g. 78701)"
          className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-full px-6 py-3.5 text-white text-lg focus:outline-none focus:border-green-500/60"
        />
        <button type="submit" className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">
          Check Coverage <ArrowRight size={16}/>
        </button>
      </form>

      {result && (
        <div className={`mt-5 p-5 rounded-xl border ${result.ok ? 'bg-green-500/5 border-green-500/30' : 'bg-orange-500/5 border-orange-500/30'}`}>
          {result.ok ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-green-400 mt-0.5 flex-shrink-0" size={22}/>
              <div>
                <div className="text-white font-semibold">✅ Yes! We serve {result.name}.</div>
                <p className="text-neutral-300 text-sm mt-1">Ready to schedule? Get your free estimate or call us today.</p>
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <Link to="/contact" className="btn-green inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm">Get Free Quote <ArrowRight size={14}/></Link>
                  <Link to={`/service-areas/${result.slug}`} className="btn-dark inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm">View Local Services</Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <XCircle className="text-orange-400 mt-0.5 flex-shrink-0" size={22}/>
              <div>
                <div className="text-white font-semibold">{result.message}</div>
                {result.notListed && (
                  <Link to="/contact" className="mt-3 inline-flex items-center gap-2 text-green-400 font-medium text-sm">Contact us anyway <ArrowRight size={14}/></Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ZipChecker;

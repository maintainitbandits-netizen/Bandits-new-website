import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Send, Loader2 } from 'lucide-react';
import { SERVICES, SERVICE_AREAS, COMPANY } from '../mock';
import { useToast } from '../hooks/use-toast';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/maqkbaql';

const MultiStepQuote = () => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    service: '', city: '', propertyType: '', name: '', email: '', phone: '', message: '',
  });

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const canAdvance = () => {
    if (step === 1) return !!form.service;
    if (step === 2) return !!form.city;
    if (step === 3) return !!form.propertyType;
    if (step === 4) return form.name && form.email && form.phone;
    return false;
  };

  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          ...form,
          _subject: `New Quote Request — ${form.service} in ${form.city}`,
          source: 'multi-step quote',
        }),
      });
      if (res.ok) {
        setDone(true);
        toast({ title: 'Quote request sent!', description: 'We’ll respond within 24 hours.' });
      } else {
        toast({ title: 'Submission failed', description: 'Please try again or call us.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Please check your connection and try again.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="bg-[#0f0f0f] border border-green-500/30 rounded-2xl p-10 text-center">
        <div className="h-16 w-16 rounded-full bg-green-500/15 border border-green-500/40 grid place-items-center mx-auto"><Check size={32} className="text-green-400"/></div>
        <h3 className="font-serif text-3xl text-white mt-5">Thanks, {form.name.split(' ')[0]}!</h3>
        <p className="text-neutral-300 mt-3">Your quote request was received. We&apos;ll be in touch within 24 hours — usually much sooner.</p>
        <p className="text-neutral-500 text-sm mt-4">Need it immediately? Call <a href={`tel:${COMPANY.phoneRaw}`} className="text-green-400 hover:underline">{COMPANY.phone}</a></p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7 md:p-9">
      <div className="flex justify-between items-center text-xs text-neutral-400 mb-3">
        <span>Step {step} of {totalSteps}</span>
        <span>{Math.round(progress)}% complete</span>
      </div>
      <div className="h-1.5 bg-[#161616] rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500" style={{ width: `${progress}%` }}/>
      </div>

      <div className="mt-8 min-h-[260px]">
        {step === 1 && (
          <div>
            <h3 className="font-serif text-2xl text-white">What service do you need?</h3>
            <p className="text-neutral-400 text-sm mt-2">Pick the option closest to what you&apos;re looking for.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              {SERVICES.map(s => (
                <button key={s.slug} onClick={() => setField('service', s.title)} className={`text-left p-4 rounded-xl border transition-colors ${form.service === s.title ? 'border-green-500/60 bg-green-500/5 text-white' : 'border-[#222] bg-[#0a0a0a] text-neutral-300 hover:border-green-500/40'}`}>
                  <div className="font-semibold">{s.title}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="font-serif text-2xl text-white">Where is your property?</h3>
            <p className="text-neutral-400 text-sm mt-2">Select your city in the Austin metro area.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
              {SERVICE_AREAS.map(a => (
                <button key={a.slug} onClick={() => setField('city', a.name)} className={`p-3 rounded-xl border transition-colors text-sm ${form.city === a.name ? 'border-green-500/60 bg-green-500/5 text-white' : 'border-[#222] bg-[#0a0a0a] text-neutral-300 hover:border-green-500/40'}`}>
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="font-serif text-2xl text-white">Property type?</h3>
            <p className="text-neutral-400 text-sm mt-2">Helps us prepare the right quote.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              {['Residential Home', 'Townhome / Condo', 'Commercial Property'].map(t => (
                <button key={t} onClick={() => setField('propertyType', t)} className={`p-4 rounded-xl border transition-colors ${form.propertyType === t ? 'border-green-500/60 bg-green-500/5 text-white' : 'border-[#222] bg-[#0a0a0a] text-neutral-300 hover:border-green-500/40'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="font-serif text-2xl text-white">Last step — your contact info</h3>
            <p className="text-neutral-400 text-sm mt-2">We&apos;ll send your free quote within 24 hours.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <input required value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Full name" className="bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60"/>
              <input required type="email" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="Email" className="bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60"/>
              <input required value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="Phone" className="bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60 sm:col-span-2"/>
              <textarea rows={3} value={form.message} onChange={e => setField('message', e.target.value)} placeholder="Anything else we should know? (Optional)" className="bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60 sm:col-span-2"/>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between items-center">
        <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="text-neutral-400 text-sm inline-flex items-center gap-2 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
          <ArrowLeft size={14}/> Back
        </button>
        {step < totalSteps ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()} className="btn-green inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            Continue <ArrowRight size={16}/>
          </button>
        ) : (
          <button onClick={submit} disabled={!canAdvance() || loading} className="btn-green inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (<>Sending... <Loader2 size={16} className="animate-spin"/></>) : (<>Get My Quote <Send size={16}/></>)}
          </button>
        )}
      </div>
    </div>
  );
};

export default MultiStepQuote;

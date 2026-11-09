import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Send, Loader2 } from 'lucide-react';
import { SERVICES, SERVICE_AREAS, COMPANY } from '../mock';
import { FORMSPREE_ENDPOINT, RENTAL_CITIES, PROPERTY_TYPES, RENTAL_PROPERTY_TYPES, isRentalService, quotePayload } from '../data/quote';
import { useToast } from '../hooks/use-toast';

const inputClass = 'w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60';

const MultiStepQuote = ({ form, setField }) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const rental = isRentalService(form.service);
  const cities = rental ? RENTAL_CITIES : SERVICE_AREAS;
  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const canAdvance = () => {
    if (step === 1) return !!form.service;
    if (step === 2) return !!form.city && (form.city !== 'Other' || !!form.customCity.trim());
    if (step === 3) return !!form.propertyType && (!rental || !form.units || Number(form.units) > 0);
    if (step === 4) return !!form.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && !!form.phone.trim();
    return false;
  };

  const submit = async () => {
    if (!canAdvance() || loading) return;
    setLoading(true);
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(quotePayload(form, 'multi-step quote')),
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
      <div role="status" className="bg-[#0f0f0f] border border-green-500/30 rounded-2xl p-10 text-center">
        <div className="h-16 w-16 rounded-full bg-green-500/15 border border-green-500/40 grid place-items-center mx-auto"><Check size={32} className="text-green-400"/></div>
        <h3 className="font-serif text-3xl text-white mt-5">Thanks, {form.name.trim().split(' ')[0]}!</h3>
        <p className="text-neutral-300 mt-3">Your quote request was received. We&apos;ll respond within 24 hours.</p>
        <p className="text-neutral-500 text-sm mt-4">Questions? Call <a href={`tel:${COMPANY.phoneRaw}`} className="text-green-400 hover:underline">{COMPANY.phone}</a></p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7 md:p-9">
      <div className="flex justify-between items-center text-xs text-neutral-400 mb-3"><span>Step {step} of {totalSteps}</span><span>{Math.round(progress)}% complete</span></div>
      <div className="h-1.5 bg-[#161616] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500" style={{ width: `${progress}%` }}/></div>
      <div className="mt-8 min-h-[260px]">
        {step === 1 && <div>
          <h3 className="font-serif text-2xl text-white">What service do you need?</h3>
          <p className="text-neutral-400 text-sm mt-2">Pick the option closest to what you&apos;re looking for.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            {SERVICES.map(s => <button type="button" key={s.slug} aria-pressed={form.service === s.title} onClick={() => setField('service', s.title)} className={`text-left p-4 rounded-xl border transition-colors ${form.service === s.title ? 'border-green-500/60 bg-green-500/5 text-white' : 'border-[#222] bg-[#0a0a0a] text-neutral-300 hover:border-green-500/40'}`}><div className="font-semibold">{s.title}</div></button>)}
          </div>
        </div>}
        {step === 2 && <div>
          <h3 className="font-serif text-2xl text-white">Where is your property?</h3>
          <p className="text-neutral-400 text-sm mt-2">{rental ? 'Choose a city or enter another nearby location. Availability depends on the property and project.' : 'Select your city in the Austin metro area.'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
            {cities.map(a => <button type="button" key={a.slug} aria-pressed={form.city === a.name} onClick={() => setField('city', a.name)} className={`p-3 rounded-xl border transition-colors text-sm ${form.city === a.name ? 'border-green-500/60 bg-green-500/5 text-white' : 'border-[#222] bg-[#0a0a0a] text-neutral-300 hover:border-green-500/40'}`}>{a.name}</button>)}
            {rental && <button type="button" aria-pressed={form.city === 'Other'} onClick={() => setField('city', 'Other')} className={`p-3 rounded-xl border transition-colors text-sm ${form.city === 'Other' ? 'border-green-500/60 bg-green-500/5 text-white' : 'border-[#222] bg-[#0a0a0a] text-neutral-300 hover:border-green-500/40'}`}>Other nearby city</button>}
          </div>
          {rental && form.city === 'Other' && <label className="block text-sm text-neutral-300 mt-5">Your city <span className="text-green-400">*</span><input autoComplete="address-level2" maxLength={100} value={form.customCity} onChange={e => setField('customCity', e.target.value)} className={`${inputClass} mt-2`} placeholder="Enter your city" /></label>}
        </div>}
        {step === 3 && <div>
          <h3 className="font-serif text-2xl text-white">Property type?</h3>
          <p className="text-neutral-400 text-sm mt-2">This helps us understand your project.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            {(rental ? RENTAL_PROPERTY_TYPES : PROPERTY_TYPES).map(t => <button type="button" key={t} aria-pressed={form.propertyType === t} onClick={() => setField('propertyType', t)} className={`p-4 rounded-xl border transition-colors ${form.propertyType === t ? 'border-green-500/60 bg-green-500/5 text-white' : 'border-[#222] bg-[#0a0a0a] text-neutral-300 hover:border-green-500/40'}`}>{t}</button>)}
          </div>
          {rental && <div className="grid sm:grid-cols-2 gap-4 mt-7">
            <label className="block text-sm text-neutral-300 sm:col-span-2">Property address or name <span className="text-neutral-500">(optional)</span><input autoComplete="street-address" maxLength={200} value={form.propertyAddress} onChange={e => setField('propertyAddress', e.target.value)} className={`${inputClass} mt-2`} placeholder="Address or property name" /></label>
            <label className="block text-sm text-neutral-300">I&apos;m a... <span className="text-neutral-500">(optional)</span><select value={form.customerRole} onChange={e => setField('customerRole', e.target.value)} className={`${inputClass} mt-2`}><option value="">Select one</option><option>Property manager</option><option>Landlord / rental owner</option><option>Other</option></select></label>
            <label className="block text-sm text-neutral-300">Number of units <span className="text-neutral-500">(optional)</span><input type="number" min="1" step="1" inputMode="numeric" value={form.units} onChange={e => setField('units', e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} className={`${inputClass} mt-2`} placeholder="e.g. 1" /></label>
            <label className="block text-sm text-neutral-300 sm:col-span-2">Desired completion date <span className="text-neutral-500">(optional; subject to availability)</span><input type="date" value={form.desiredDate} onChange={e => setField('desiredDate', e.target.value)} className={`${inputClass} mt-2`} /></label>
          </div>}
        </div>}
        {step === 4 && <div>
          <h3 className="font-serif text-2xl text-white">Last step — your contact info</h3>
          <p className="text-neutral-400 text-sm mt-2">We&apos;ll respond within 24 hours. Pricing and scheduling are discussed for your project.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <label className="text-sm text-neutral-300">Full name *<input autoComplete="name" value={form.name} onChange={e => setField('name', e.target.value)} className={`${inputClass} mt-2`} /></label>
            <label className="text-sm text-neutral-300">Email *<input type="email" autoComplete="email" value={form.email} onChange={e => setField('email', e.target.value)} className={`${inputClass} mt-2`} /></label>
            <label className="text-sm text-neutral-300 sm:col-span-2">Phone *<input type="tel" autoComplete="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} className={`${inputClass} mt-2`} /></label>
            <label className="text-sm text-neutral-300 sm:col-span-2">What work is needed? <span className="text-neutral-500">(optional; you can include your checklist)</span><textarea rows={3} value={form.message} onChange={e => setField('message', e.target.value)} className={`${inputClass} mt-2`} /></label>
          </div>
        </div>}
      </div>
      <div className="mt-8 flex justify-between items-center">
        <button type="button" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="text-neutral-400 text-sm inline-flex items-center gap-2 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"><ArrowLeft size={14}/> Back</button>
        {step < totalSteps ? <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canAdvance()} className="btn-green inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Continue <ArrowRight size={16}/></button> : <button type="button" onClick={submit} disabled={!canAdvance() || loading} className="btn-green inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed">{loading ? (<>Sending... <Loader2 size={16} className="animate-spin"/></>) : (<>Send Request <Send size={16}/></>)}</button>}
      </div>
    </div>
  );
};

export default MultiStepQuote;

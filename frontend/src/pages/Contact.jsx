import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Phone, Mail, MapPin, Clock, Check, Send, Loader2, Zap, FileText } from 'lucide-react';
import { COMPANY, SERVICES } from '../mock';
import { MAP_QUERY } from '../config/social';
import { useToast } from '../hooks/use-toast';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import MultiStepQuote from '../components/MultiStepQuote';
import { FORMSPREE_ENDPOINT, RENTAL_CITIES, RENTAL_PROPERTY_TYPES, initialQuote, isRentalService, quotePayload, updateQuoteField } from '../data/quote';

const Contact = () => {
  const { toast } = useToast();
  const { search } = useLocation();
  const previousSearch = useRef(search);
  const [mode, setMode] = useState('quick');
  const [form, setForm] = useState(() => initialQuote(search));
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const rental = isRentalService(form.service);

  // A new service/city link should preselect that request even when Contact is
  // already mounted. Preserve contact details if the visitor has started typing.
  useEffect(() => {
    if (previousSearch.current === search) return;
    previousSearch.current = search;
    const selected = initialQuote(search);
    setForm(prev => ({ ...updateQuoteField(prev, 'service', selected.service), city: selected.city, customCity: '' }));
    setSubmitted(false);
  }, [search]);

  const setField = (key, value) => setForm(prev => updateQuoteField(prev, key, value));
  const handleChange = (e) => setField(e.target.name, e.target.value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rental && form.city === 'Other' && !form.customCity.trim()) {
      setError('Please enter your city, or choose a listed city.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(quotePayload(form, 'detailed message')),
      });
      if (res.ok) {
        setSubmitted(true);
        toast({ title: 'Estimate Request Sent!', description: 'We\u2019ll get back to you within 24 hours.' });
        setForm(initialQuote(search));
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data?.errors?.map(er => er.message).join(', ') || 'Something went wrong. Please try again or call us directly.';
        setError(msg);
        toast({ title: 'Submission failed', description: msg, variant: 'destructive' });
      }
    } catch (err) {
      const msg = 'Network error. Please check your connection and try again.';
      setError(msg);
      toast({ title: 'Submission failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SEO
        title="Contact Maintain It Bandits LLC | Request a Quote Austin TX"
        description="Contact Maintain It Bandits LLC about lawn care, landscaping, cleaning, make-ready and home services in Austin TX. Call (512) 518-1558."
        keywords="contact lawn care Austin TX, quote Austin, Maintain It Bandits contact"
        path="/contact"
      />
      <Breadcrumbs items={[{ name: 'Contact', path: '/contact' }]}/>
      <section className="py-16 bg-[#0a0a0a] border-b border-[#161616]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
          <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">Contact</span>
          <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Request an Estimate</h1>
          <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Tell us about your property using the step-by-step request or a detailed message. We&apos;ll respond within 24 hours.</p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            {/* Tab switcher */}
            <div className="bg-[#0a0a0a] border border-[#1c1c1c] rounded-full p-1 inline-flex gap-1 mb-6">
              <button onClick={() => setMode('quick')} className={`px-5 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors ${mode === 'quick' ? 'btn-green' : 'text-neutral-400 hover:text-white'}`}>
                <Zap size={14}/> Step-by-Step Request
              </button>
              <button onClick={() => setMode('detailed')} className={`px-5 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors ${mode === 'detailed' ? 'btn-green' : 'text-neutral-400 hover:text-white'}`}>
                <FileText size={14}/> Detailed Message
              </button>
            </div>

            {mode === 'quick' ? <MultiStepQuote form={form} setField={setField} /> : (
            <form onSubmit={handleSubmit} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm text-neutral-300 mb-2">Full Name *</label>
                  <input name="name" required value={form.name} onChange={handleChange} className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60" placeholder="John Doe"/>
                </div>
                <div>
                  <label className="block text-sm text-neutral-300 mb-2">Email *</label>
                  <input type="email" name="email" required value={form.email} onChange={handleChange} className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60" placeholder="you@email.com"/>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm text-neutral-300 mb-2">Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60" placeholder="(512) 555-1234"/>
                </div>
                <div>
                  <label className="block text-sm text-neutral-300 mb-2">Service Needed *</label>
                  <select name="service" required value={form.service} onChange={handleChange} className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60">
                    <option value="">Select a service</option>
                    {SERVICES.map(s => <option key={s.slug} value={s.title}>{s.title}</option>)}
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              {rental && <div className="space-y-4 border-t border-[#222] pt-5">
                <p className="text-neutral-400 text-sm">Rental details are optional. Availability depends on your property and the work requested.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <label className="block text-sm text-neutral-300">Property city <select name="city" value={form.city} onChange={handleChange} className="mt-2 w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60"><option value="">Select a city</option>{RENTAL_CITIES.map(a => <option key={a.slug} value={a.name}>{a.name}</option>)}<option value="Other">Other nearby city</option></select></label>
                  {form.city === 'Other' && <label className="block text-sm text-neutral-300">Your city *<input name="customCity" maxLength={100} required value={form.customCity} onChange={handleChange} className="mt-2 w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60" /></label>}
                  <label className="block text-sm text-neutral-300">Property address or name <input name="propertyAddress" autoComplete="street-address" maxLength={200} value={form.propertyAddress} onChange={handleChange} placeholder="Address or property name" className="mt-2 w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60" /></label>
                  <label className="block text-sm text-neutral-300">Property type <select name="propertyType" value={form.propertyType} onChange={handleChange} className="mt-2 w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60"><option value="">Select one</option>{RENTAL_PROPERTY_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
                  <label className="block text-sm text-neutral-300">I&apos;m a... <select name="customerRole" value={form.customerRole} onChange={handleChange} className="mt-2 w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60"><option value="">Select one</option><option>Property manager</option><option>Landlord / rental owner</option><option>Other</option></select></label>
                  <label className="block text-sm text-neutral-300">Number of units <input type="number" min="1" step="1" inputMode="numeric" name="units" value={form.units} onChange={e => setField('units', e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} placeholder="e.g. 1" className="mt-2 w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60" /></label>
                  <label className="block text-sm text-neutral-300">Desired completion date <span className="text-neutral-500">(subject to availability)</span><input type="date" name="desiredDate" value={form.desiredDate} onChange={handleChange} className="mt-2 w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60" /></label>
                </div>
              </div>}
              <div>
                <label className="block text-sm text-neutral-300 mb-2" htmlFor="contact-message">Message</label>
                <textarea id="contact-message" name="message" rows={5} value={form.message} onChange={handleChange} className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60" placeholder={rental ? 'Tell us what the rental needs or include your checklist...' : 'Tell us about your project...'}/>
              </div>
              <button type="submit" disabled={loading} className="btn-green inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold disabled:opacity-70 disabled:cursor-not-allowed">
                {loading ? (<>Sending... <Loader2 size={16} className="animate-spin"/></>) : (<>Send Request <Send size={16}/></>)}
              </button>
              {submitted && <p className="text-green-400 text-sm flex items-center gap-2"><Check size={16}/> Your request was received. We&apos;ll be in touch within 24 hours!</p>}
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </form>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7">
              <h3 className="text-white font-semibold text-lg">Contact Information</h3>
              <ul className="mt-5 space-y-4 text-sm">
                <li className="flex items-start gap-3"><Phone size={18} className="text-green-400 mt-0.5"/><div><div className="text-neutral-400">Phone</div><a href={`tel:${COMPANY.phoneRaw}`} className="text-white hover:text-green-400">{COMPANY.phone}</a></div></li>
                <li className="flex items-start gap-3"><Mail size={18} className="text-green-400 mt-0.5"/><div><div className="text-neutral-400">Email</div><a href={`mailto:${COMPANY.email}`} className="text-white hover:text-green-400">{COMPANY.email}</a></div></li>
                <li className="flex items-start gap-3"><MapPin size={18} className="text-green-400 mt-0.5"/><div><div className="text-neutral-400">Service Area</div><div className="text-white">{COMPANY.area}</div></div></li>
                <li className="flex items-start gap-3"><Clock size={18} className="text-green-400 mt-0.5"/><div><div className="text-neutral-400">Business Hours</div><div className="text-white">{COMPANY.hours}</div></div></li>
              </ul>
            </div>
            <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7">
              <h3 className="text-white font-semibold text-lg">Why Choose Us?</h3>
              <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                {['Fully Licensed & Insured','Response Within 24 Hours','Quotes Based on Your Project','Serving Greater Austin'].map((w,i)=>(
                  <li key={i} className="flex items-start gap-2"><Check size={16} className="text-green-400 mt-0.5"/> {w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

      {/* GOOGLE MAP */}
      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden">
            <div className="aspect-[16/7]">
              <iframe
                title="Maintain It Bandits Service Area Map"
                src={`https://maps.google.com/maps?q=${MAP_QUERY}&z=10&output=embed`}
                width="100%"
                height="100%"
                style={{ border: 0, filter: 'invert(0.92) hue-rotate(180deg) contrast(0.85)' }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      </section>
    </div>
  );
};

export default Contact;

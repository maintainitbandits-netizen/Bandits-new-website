import React, { useState } from 'react';
import { Phone, Mail, MapPin, Clock, Check, Send, Loader2 } from 'lucide-react';
import { COMPANY, SERVICES } from '../mock';
import { useToast } from '../hooks/use-toast';
import SEO from '../components/SEO';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/maqkbaql';

const Contact = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', service: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          service: form.service,
          message: form.message,
          _subject: `New Estimate Request from ${form.name || 'Website'} \u2014 ${form.service || 'General'}`,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        toast({ title: 'Estimate Request Sent!', description: 'We\u2019ll get back to you within 24 hours.' });
        setForm({ name: '', email: '', phone: '', service: '', message: '' });
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
        title="Contact Maintain It Bandits LLC | Free Estimate Austin TX"
        description="Contact Maintain It Bandits LLC for a free, no-obligation estimate on lawn care, landscaping, cleaning, and home services in Austin TX. Call (512) 518-1558."
        keywords="contact lawn care Austin TX, free estimate lawn care Austin, Maintain It Bandits contact"
        path="/contact"
      />
      <section className="py-20 bg-[#0a0a0a] border-b border-[#161616]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
          <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">Contact</span>
          <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Get Your Free Estimate</h1>
          <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Ready to transform your Austin TX property? Contact Maintain It Bandits LLC today for a free, no-obligation estimate.</p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
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
              <div>
                <label className="block text-sm text-neutral-300 mb-2">Message</label>
                <textarea name="message" rows={5} value={form.message} onChange={handleChange} className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60" placeholder="Tell us about your project..."/>
              </div>
              <button type="submit" disabled={loading} className="btn-green inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold disabled:opacity-70 disabled:cursor-not-allowed">
                {loading ? (<>Sending... <Loader2 size={16} className="animate-spin"/></>) : (<>Request Free Estimate <Send size={16}/></>)}
              </button>
              {submitted && <p className="text-green-400 text-sm flex items-center gap-2"><Check size={16}/> Your request was received. We&apos;ll be in touch within 24 hours!</p>}
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </form>
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
                {['Licensed & Insured','Free, No-Obligation Estimates','Same Week Service Available','5-Star Rated on Google','One-Stop Shop for All Home Services'].map((w,i)=>(
                  <li key={i} className="flex items-start gap-2"><Check size={16} className="text-green-400 mt-0.5"/> {w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;

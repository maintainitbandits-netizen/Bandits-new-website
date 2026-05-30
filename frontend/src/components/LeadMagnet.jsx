import React, { useState } from 'react';
import { Download, CheckCircle2, Loader2, Calendar, Send } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/maqkbaql';

const LeadMagnet = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'Lead Magnet — Austin Lawn Calendar PDF',
          _subject: `Lead Magnet Download — ${email}`,
        }),
      });
      if (res.ok) {
        setDone(true);
        toast({ title: 'Check your inbox!', description: 'Your free Austin Lawn Care Calendar is on the way.' });
      } else {
        toast({ title: 'Submission failed', description: 'Please try again.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <section className="py-24 bg-[#080808]">
      <div className="max-w-5xl mx-auto px-5 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-center bg-[#0f0f0f] border border-green-500/20 rounded-3xl p-8 md:p-12">
          <div className="lg:col-span-3">
            <div className="inline-flex items-center gap-2 chip px-3 py-1 rounded-full text-xs tracking-widest font-medium uppercase"><Download size={12}/> Free Download</div>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5 leading-tight">The Austin Lawn Care Calendar</h2>
            <p className="text-neutral-300 mt-4 leading-relaxed">A free 12-month PDF guide written by our Austin lawn pros. Know exactly when to mow, fertilize, water, aerate, and overseed for a thriving Central Texas lawn.</p>
            <ul className="mt-5 space-y-2 text-sm">
              {['Month-by-month task checklist', 'Fertilization timing for Bermuda, St. Augustine & Zoysia', 'Watering schedule (Austin restrictions friendly)', 'Pre/post-emergent timing for weed control'].map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-neutral-200"><CheckCircle2 size={16} className="text-green-400 mt-0.5 flex-shrink-0"/> {it}</li>
              ))}
            </ul>

            {done ? (
              <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 flex items-start gap-3">
                <CheckCircle2 className="text-green-400 mt-0.5" size={20}/>
                <div className="text-sm text-neutral-200">Your free guide is on the way! Check your inbox (and spam folder) within a few minutes.</div>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-7 flex flex-col sm:flex-row gap-3">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email address" className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-full px-5 py-3.5 text-white focus:outline-none focus:border-green-500/60"/>
                <button disabled={loading} type="submit" className="btn-green inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold whitespace-nowrap">
                  {loading ? (<>Sending... <Loader2 size={16} className="animate-spin"/></>) : (<>Send Me the Guide <Send size={16}/></>)}
                </button>
              </form>
            )}
            <p className="text-neutral-500 text-xs mt-3">No spam. Unsubscribe anytime. We only send seasonal lawn care tips.</p>
          </div>
          <div className="lg:col-span-2 flex justify-center">
            <div className="relative">
              <div className="absolute -inset-3 bg-green-500/10 rounded-3xl blur-xl"/>
              <div className="relative bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-8 shadow-2xl w-64 aspect-[3/4] flex flex-col justify-between border border-green-500/40">
                <div>
                  <Calendar className="text-white/80" size={32}/>
                  <div className="text-white text-xs uppercase tracking-widest mt-4 opacity-80">Free Guide</div>
                  <h3 className="text-white font-serif text-2xl mt-2 leading-tight">Austin Lawn Care Calendar</h3>
                </div>
                <div>
                  <div className="text-white/60 text-xs">12 Months · 28 Pages</div>
                  <div className="text-white font-bold mt-1">Maintain It Bandits</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LeadMagnet;

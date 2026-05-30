import React, { useState } from 'react';
import { Mail, Check, Loader2, Send } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/maqkbaql';

const NewsletterSignup = () => {
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
          source: 'Newsletter Signup',
          _subject: `Newsletter Signup — ${email}`,
        }),
      });
      if (res.ok) {
        setDone(true);
        setEmail('');
        toast({ title: 'You\u2019re subscribed!', description: 'Look for seasonal lawn care tips in your inbox.' });
      } else {
        toast({ title: 'Subscription failed', description: 'Please try again.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-green-500/15 border border-green-500/40 grid place-items-center"><Mail className="text-green-400" size={18}/></div>
        <div>
          <h4 className="text-white font-semibold">Free Lawn Care Tips</h4>
          <p className="text-neutral-500 text-xs mt-0.5">Seasonal Austin-specific advice. No spam.</p>
        </div>
      </div>
      {done ? (
        <div className="mt-5 flex items-center gap-2 text-green-400 text-sm"><Check size={16}/> Thanks! You&apos;re on the list.</div>
      ) : (
        <form onSubmit={submit} className="mt-5 flex gap-2">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/60"/>
          <button disabled={loading} type="submit" className="btn-green inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm disabled:opacity-70">
            {loading ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
          </button>
        </form>
      )}
    </div>
  );
};

export default NewsletterSignup;

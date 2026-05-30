import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';

const FAQ_GROUPS = [
  {
    title: 'General',
    faqs: [
      { q: 'Are you licensed and insured?', a: 'Yes — Maintain It Bandits LLC is fully licensed and insured. We carry general liability and workers’ compensation coverage to protect your property and our crews.' },
      { q: 'What areas of Austin do you serve?', a: 'We serve the entire greater Austin metro area including Austin (78701–78759), Round Rock, Cedar Park, Georgetown, Pflugerville, Leander, Bee Cave, West Lake Hills, Lakeway, and Dripping Springs.' },
      { q: 'Do you offer free estimates?', a: 'Yes — every estimate is free and there’s zero obligation. We’ll visit your property, listen to your goals, and put together a written quote.' },
      { q: 'How quickly can you start service?', a: 'Most new clients can be on our schedule within the same week. For larger landscape projects, scheduling depends on size and time of year.' },
      { q: 'What forms of payment do you accept?', a: 'Cash, check, all major credit/debit cards, Zelle, and Apple Pay. Recurring service clients can be set up on auto-pay.' },
    ],
  },
  {
    title: 'Lawn Care',
    faqs: [
      { q: 'How often should I mow my Austin lawn?', a: 'During peak growing season (April–September), most Austin lawns benefit from weekly mowing. In cooler months, bi-weekly is usually sufficient.' },
      { q: 'Do you bag clippings or mulch them?', a: 'We typically mulch clippings back into the lawn to return nutrients, but we will bag on request or when growth is excessive.' },
      { q: 'What if it rains on my mowing day?', a: 'We’ll reschedule to the next available day. We never mow saturated lawns — it damages turf and leaves ruts.' },
      { q: 'How much does weekly lawn mowing cost in Austin?', a: 'Most residential weekly plans range from $45–$95 per visit depending on lot size and condition. See our pricing page for details.' },
    ],
  },
  {
    title: 'Landscaping',
    faqs: [
      { q: 'How long does a landscape installation take?', a: 'Small projects (mulch refresh, bed install) often complete in 1–2 days. Full landscape renovations typically take 1–3 weeks depending on scope.' },
      { q: 'Do you offer design plans?', a: 'Yes — we offer design consultations and detailed plans so you know exactly what your finished landscape will look like.' },
      { q: 'What plants do you recommend for Austin?', a: 'We design with Texas-tough natives: Salvia, Mexican Feather Grass, Mountain Laurel, Yaupon Holly, Lantana, and more. They look great with very little water.' },
      { q: 'Will you remove old plants and debris?', a: 'Yes — full debris haul-off is included with every install.' },
    ],
  },
  {
    title: 'Cleaning Services',
    faqs: [
      { q: 'Do you bring your own cleaning supplies?', a: 'Yes — all standard cleaning supplies and equipment are included. We can use your preferred eco-friendly products on request.' },
      { q: 'How long does a move-out clean take?', a: 'Most homes take 3–6 hours depending on size and condition.' },
      { q: 'Is rodent feces cleanup safe?', a: 'When done correctly, yes. We follow CDC-recommended procedures with proper PPE, HEPA vacuums, and EPA-approved disinfectants.' },
    ],
  },
];

const FAQ = () => {
  const allFaqs = FAQ_GROUPS.flatMap(g => g.faqs);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allFaqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div>
      <SEO
        title="FAQ | Lawn Care & Home Services Questions | Maintain It Bandits LLC Austin TX"
        description="Frequently asked questions about lawn care, landscaping, sod installation, fertilization, and cleaning services in Austin TX. Get answers fast."
        keywords="lawn care faq Austin, landscaping questions Austin, home services faq Texas"
        path="/faq"
        schema={schema}
      />
      <Breadcrumbs items={[{ name: 'FAQ', path: '/faq' }]}/>

      <section className="py-16 bg-[#0a0a0a] border-b border-[#161616]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
          <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase"><HelpCircle size={14}/> FAQ</span>
          <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Frequently Asked Questions</h1>
          <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Quick answers to common questions about our Austin TX lawn care, landscaping, and home services.</p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 space-y-12">
          {FAQ_GROUPS.map(g => (
            <div key={g.title}>
              <h2 className="font-serif text-2xl md:text-3xl text-white border-b border-[#1c1c1c] pb-3">{g.title}</h2>
              <div className="mt-6 space-y-3">
                {g.faqs.map((f, i) => (
                  <details key={i} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-5 group hover:border-green-500/30 transition-colors">
                    <summary className="cursor-pointer text-white font-medium flex justify-between items-start gap-4 list-none">
                      <span>{f.q}</span>
                      <span className="text-green-400 group-open:rotate-45 transition-transform text-xl leading-none flex-shrink-0">+</span>
                    </summary>
                    <p className="mt-3 text-neutral-300 leading-relaxed text-sm">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <CTASection />
    </div>
  );
};

export default FAQ;

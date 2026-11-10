import React from 'react';
import { HelpCircle } from 'lucide-react';
import { MAKE_READY_FAQS } from '../data/makeReady';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';

const FAQ_GROUPS = [
  {
    title: 'General',
    faqs: [
      { q: 'Are you licensed and insured?', a: 'Yes — Maintain It Bandits LLC is fully licensed and insured.' },
      { q: 'What areas do you serve?', a: 'We consider projects in Austin and nearby communities. Tell us the property location and work needed so we can confirm availability.' },
      { q: 'How do I request an estimate?', a: 'Contact us with the property location and details of the work. We respond within 24 hours.' },
      { q: 'How quickly can you start service?', a: 'We respond within 24 hours. Scheduling depends on the project and availability.' },
      { q: 'What forms of payment do you accept?', a: 'Cash, check, all major credit/debit cards, Zelle, and Apple Pay. Recurring service clients can be set up on auto-pay.' },
    ],
  },
  {
    title: 'Lawn Care',
    faqs: [
      { q: 'How often should I mow my Austin lawn?', a: 'During peak growing season (April–September), most Austin lawns benefit from weekly mowing. In cooler months, bi-weekly is usually sufficient.' },
      { q: 'Do you bag clippings or mulch them?', a: 'We typically mulch clippings back into the lawn to return nutrients, but we will bag on request or when growth is excessive.' },
      { q: 'What if it rains on my mowing day?', a: 'We’ll reschedule to the next available day. We never mow saturated lawns — it damages turf and leaves ruts.' },
      { q: 'How much does weekly lawn mowing cost in Austin?', a: 'Pricing depends on the property size, condition, frequency and work requested. Contact us to discuss a quote.' },
    ],
  },
  {
    title: 'Landscaping',
    faqs: [
      { q: 'How long does a landscape installation take?', a: 'Timing depends on the size, site conditions, materials and agreed scope. Share your target date when requesting an estimate.' },
      { q: 'Do you offer design plans?', a: 'Yes — we offer design consultations and detailed plans so you know exactly what your finished landscape will look like.' },
      { q: 'What plants do you recommend for Austin?', a: 'We design with Texas-tough natives: Salvia, Mexican Feather Grass, Mountain Laurel, Yaupon Holly, Lantana, and more. They look great with very little water.' },
      { q: 'Will you remove old plants and debris?', a: 'Tell us whether old plants or debris need to be removed so the scope can be included in your quote.' },
    ],
  },
  {
    title: 'Cleaning Services',
    faqs: [
      { q: 'Do you bring your own cleaning supplies?', a: 'Mention any supply or product preferences when requesting a quote so the details can be discussed for your property.' },
      { q: 'How long does a move-out clean take?', a: 'Timing depends on the property size, condition and agreed work. Share your target date when requesting a quote.' },
      { q: 'Is rodent feces cleanup safe?', a: 'Do not sweep or vacuum rodent droppings. Follow current CDC guidance and discuss the conditions, precautions and appropriate scope before work begins.' },
    ],
  },
  {
    title: 'Make Readys & Tenant Turnovers',
    faqs: MAKE_READY_FAQS,
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

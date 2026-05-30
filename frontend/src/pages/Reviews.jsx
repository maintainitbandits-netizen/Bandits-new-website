import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ExternalLink, Quote, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';
import { GOOGLE_REVIEWS, REVIEW_STATS, SOCIAL } from '../config/social';
import { COMPANY } from '../mock';

const Reviews = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: COMPANY.name,
    telephone: COMPANY.phone,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: REVIEW_STATS.rating.toString(),
      reviewCount: REVIEW_STATS.count.toString(),
      bestRating: '5',
    },
    review: GOOGLE_REVIEWS.map(r => ({
      '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: r.rating.toString(), bestRating: '5' },
      author: { '@type': 'Person', name: r.name },
      reviewBody: r.text,
    })),
  };

  return (
    <div>
      <SEO
        title="Customer Reviews & Testimonials | Maintain It Bandits LLC Austin TX"
        description={`Read ${REVIEW_STATS.count}+ five-star Google reviews from Austin TX homeowners who trust Maintain It Bandits LLC for lawn care, landscaping, and home services.`}
        keywords="Maintain It Bandits reviews, Austin lawn care reviews, lawn service reviews Austin TX"
        path="/reviews"
        schema={schema}
      />
      <Breadcrumbs items={[{ name: 'Reviews', path: '/reviews' }]}/>

      <section className="py-16 bg-[#0a0a0a] border-b border-[#161616]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
          <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase"><Star size={14}/> Reviews</span>
          <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">What Our Customers Say</h1>

          <div className="mt-8 flex flex-col items-center">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} size={28} className="text-green-400 fill-green-400"/>)}
            </div>
            <div className="mt-3 text-white text-2xl font-bold">{REVIEW_STATS.rating.toFixed(1)} ★</div>
            <div className="text-neutral-400 text-sm">Based on <strong className="text-white">{REVIEW_STATS.count}+</strong> Google Reviews</div>
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <a href={SOCIAL.googleBusinessProfile} target="_blank" rel="noopener noreferrer" className="btn-dark inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold">
                See All Reviews on Google <ExternalLink size={14}/>
              </a>
              <a href={SOCIAL.googleReviewLink} target="_blank" rel="noopener noreferrer" className="btn-green inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold">
                Leave a Review <Star size={14}/>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {GOOGLE_REVIEWS.map((r, i) => (
            <div key={i} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6 hover:border-green-500/30 transition-colors">
              <div className="flex items-center gap-1">
                {[...Array(r.rating)].map((_, j) => <Star key={j} size={14} className="text-green-400 fill-green-400"/>)}
              </div>
              <Quote className="text-green-400 mt-3" size={22}/>
              <p className="text-neutral-300 italic mt-3 leading-relaxed text-sm">&ldquo;{r.text}&rdquo;</p>
              <div className="mt-5 pt-4 border-t border-[#1c1c1c] flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold text-sm">{r.name}</div>
                  <div className="text-neutral-500 text-xs mt-0.5">{r.date}</div>
                </div>
                <div className="text-xs text-neutral-500 flex items-center gap-1">
                  <svg viewBox="0 0 24 24" width="14" height="14"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
                  Google
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-[#080808]">
        <div className="max-w-4xl mx-auto px-5 lg:px-8">
          <div className="bg-gradient-to-br from-[#0f1d12] to-[#0a0a0a] border border-green-500/20 rounded-3xl p-10 text-center">
            <h2 className="font-serif text-3xl md:text-4xl text-white">Loved Our Service?</h2>
            <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">A 60-second Google review helps Austin neighbors find us — and helps us keep growing the business. Thank you!</p>
            <a href={SOCIAL.googleReviewLink} target="_blank" rel="noopener noreferrer" className="btn-green inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold mt-7">Leave a Google Review <ArrowRight size={16}/></a>
          </div>
        </div>
      </section>

      <CTASection />
    </div>
  );
};

export default Reviews;

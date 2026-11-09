import React from 'react';
import { Star, ExternalLink, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';
import { SOCIAL } from '../config/social';

const Reviews = () => (
  <div>
    <SEO
      title="Customer Reviews | Maintain It Bandits LLC Austin TX"
      description="Find customer reviews of Maintain It Bandits LLC on Google, or share feedback about your experience."
      keywords="Maintain It Bandits reviews, Austin home services reviews"
      path="/reviews"
    />
    <Breadcrumbs items={[{ name: 'Reviews', path: '/reviews' }]}/>
    <section className="py-20 bg-[#0a0a0a] border-b border-[#161616]">
      <div className="max-w-3xl mx-auto px-5 lg:px-8 text-center">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase"><Star size={14}/> Reviews</span>
        <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Read Our Google Reviews</h1>
        <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Visit our Google Business Profile for current customer reviews and ratings. If you&apos;ve worked with us, we&apos;d appreciate your feedback.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <a href={SOCIAL.googleBusinessProfile} target="_blank" rel="noopener noreferrer" className="btn-dark inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold">Read Reviews on Google <ExternalLink size={15}/></a>
          <a href={SOCIAL.googleReviewLink} target="_blank" rel="noopener noreferrer" className="btn-green inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold">Leave a Review <ArrowRight size={16}/></a>
        </div>
      </div>
    </section>
    <CTASection />
  </div>
);

export default Reviews;

import React from 'react';
import { Heart, Award, Users, Sprout, Recycle, Zap, CheckCircle } from 'lucide-react';
import { VALUES, STATS, TEAM_IMAGE } from '../mock';
import SEO from '../components/SEO';
import CTASection from '../components/CTASection';

const VALUE_ICONS = {
  'Reliability': Award,
  'Quality': Heart,
  'Customer Focus': Users,
  'Community': Sprout,
  'Sustainability': Recycle,
  'Efficiency': Zap,
};

const About = () => (
  <div>
    <SEO
      title="About Maintain It Bandits LLC | 3rd Generation Lawn Care Austin TX"
      description="Maintain It Bandits LLC is a 3rd generation family lawn care and home services company serving Austin TX. Locally owned, community driven, and built on decades of experience."
      canonical="https://www.maintainitbandits.com/about"
    />

    {/* HERO */}
    <section className="bg-gradient-to-br from-green-50 to-white py-16 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <span className="inline-block bg-green-100 text-green-800 text-sm font-semibold px-4 py-1 rounded-full mb-4">
          3rd Generation Family Business
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          About Maintain It Bandits
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          We are not a franchise. We are not a call center. We are a family that has been doing this work for three generations - and we treat your property like it is our own.
        </p>
      </div>
    </section>

    {/* OUR STORY */}
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Story</h2>
            <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
              <p>
                Lawn care is not just a business to us - it is in our blood. The owner of Maintain It Bandits LLC grew up in this industry, learning the trade from his father, who learned it from his father before him. Three generations of showing up, doing the work right, and taking pride in every yard we touch.
              </p>
              <p>
                That history means something. It means we have seen what works and what does not. It means we understand that your lawn is part of your home and your home is your biggest investment. And it means we have the experience to handle anything - from a simple weekly mow to a full landscape transformation.
              </p>
              <p>
                When Maintain It Bandits LLC was founded in Austin, the mission was simple: bring the same care, consistency, and craftsmanship that has defined this family for decades to the homeowners of Central Texas. Austin is our community. These are our neighbors. And we take that seriously.
              </p>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-xl">
            <img
              src={TEAM_IMAGE}
              alt="Maintain It Bandits LLC team - 3rd generation lawn care Austin TX"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>

    {/* WHY WE ARE DIFFERENT */}
    <section className="bg-green-50 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Why Homeowners Choose Us Over the Big Companies
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            There are plenty of lawn services in Austin. Here is why our customers stay with us year after year.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              title: 'We Are Part of This Community',
              body: 'We are not a national franchise that sends whoever is available. We live here. We work here. We know Austin neighborhoods, Austin soil, and Austin grass - and we are invested in making this community look its best.',
            },
            {
              title: 'Three Generations of Experience',
              body: 'Most lawn companies are started by someone who bought a truck and some equipment. Our knowledge goes back three generations. We have seen what Austin summers do to lawns, what Central Texas clay does to landscapes, and exactly what it takes to fix it.',
            },
            {
              title: 'We Show Up - Every Time',
              body: 'The number one complaint about lawn services is that they do not show up consistently. We built this company on reliability. Same crew, same day, every week. If something changes you hear from us first.',
            },
            {
              title: 'One Call for Everything',
              body: 'Lawn mowing, landscaping, sod installation, pressure washing, gutter cleaning, junk haul-off, house cleaning - we handle it all. One company, one relationship, one call. No juggling multiple vendors.',
            },
            {
              title: 'We Treat Your Property Like Our Own',
              body: 'This is not just a phrase. When our crew is on your property, they are careful, respectful, and thorough. We pick up what we knock over, we close gates behind us, and we leave every job cleaner than we found it.',
            },
            {
              title: 'No Long-Term Contracts',
              body: 'We earn your business every single visit. You are never locked in. Customers stay with us because the work is good and the service is reliable - not because of a contract.',
            },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm flex gap-4">
              <CheckCircle className="text-green-600 mt-1 shrink-0" size={22} />
              <div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* STATS */}
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s, i) => (
            <div key={i}>
              <div className="text-4xl font-bold text-green-600 mb-2">{s.value}</div>
              <div className="text-gray-600 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* VALUES */}
    <section className="bg-gray-50 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">What We Stand For</h2>
          <p className="text-lg text-gray-600">
            These are the principles that have guided this family business for three generations.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {VALUES.map(v => {
            const Icon = VALUE_ICONS[v.title] || Award;
            return (
              <div key={v.title} className="bg-white rounded-xl p-6 shadow-sm text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                  <Icon className="text-green-600" size={22} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{v.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>

    {/* SERVICE AREA CALLOUT */}
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Proudly Serving Greater Austin TX
        </h2>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          From Austin and Round Rock to Cedar Park, Georgetown, Pflugerville, Leander, Hutto, Taylor, and beyond - Maintain It Bandits LLC is your local, family-owned home services team.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {['Austin', 'Round Rock', 'Cedar Park', 'Georgetown', 'Pflugerville', 'Leander', 'Bee Cave', 'West Lake Hills', 'Lakeway', 'Dripping Springs', 'Hutto', 'Taylor'].map(city => (
            <span key={city} className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
              {city}, TX
            </span>
          ))}
        </div>
      </div>
    </section>

    <CTASection />
  </div>
);

export default About;

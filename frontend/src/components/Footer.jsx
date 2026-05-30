import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { COMPANY, SERVICES, SERVICE_AREAS } from '../mock';
import SocialIcons from './SocialIcons';
import NewsletterSignup from './NewsletterSignup';

const Footer = () => {
  return (
    <footer className="bg-[#070707] border-t border-[#161616] mt-20">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <img src={COMPANY.logo} alt={COMPANY.name} className="h-14 w-14 rounded-full bg-white p-0.5 ring-2 ring-green-500/30 object-contain" />
            <div>
              <div className="text-green-400 font-bold">{COMPANY.name}</div>
              <div className="text-[10px] tracking-[0.25em] text-orange-400/90 font-semibold">{COMPANY.tagline}</div>
            </div>
          </div>
          <p className="text-neutral-400 text-sm leading-relaxed">Austin TX&apos;s one-stop shop for lawn care, landscaping, cleaning, and home services. Licensed &amp; insured.</p>
          <ul className="mt-5 space-y-3 text-sm">
            <li className="flex items-start gap-2 text-neutral-400"><Phone size={16} className="text-green-400 mt-0.5" /> <a href={`tel:${COMPANY.phoneRaw}`} className="hover:text-green-400">{COMPANY.phone}</a></li>
            <li className="flex items-start gap-2 text-neutral-400"><Mail size={16} className="text-green-400 mt-0.5" /> <a href={`mailto:${COMPANY.email}`} className="hover:text-green-400">{COMPANY.email}</a></li>
            <li className="flex items-start gap-2 text-neutral-400"><MapPin size={16} className="text-green-400 mt-0.5" /> {COMPANY.area}</li>
            <li className="flex items-start gap-2 text-neutral-400"><Clock size={16} className="text-green-400 mt-0.5" /> {COMPANY.hours}</li>
          </ul>
          <SocialIcons className="mt-5"/>
          <div className="mt-6"><NewsletterSignup /></div>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">Services</h4>
          <ul className="space-y-2 text-sm">
            {SERVICES.map(s => (
              <li key={s.slug}><Link to={`/services/${s.slug}`} className="text-neutral-400 hover:text-green-400">{s.title}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">Service Areas</h4>
          <ul className="space-y-2 text-sm">
            {SERVICE_AREAS.slice(0, 8).map(a => (
              <li key={a.slug}><Link to={`/service-areas/${a.slug}`} className="text-neutral-400 hover:text-green-400">{a.name}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-4">Resources</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/about" className="text-neutral-400 hover:text-green-400">About Us</Link></li>
            <li><Link to="/gallery" className="text-neutral-400 hover:text-green-400">Photo Gallery</Link></li>
            <li><Link to="/reviews" className="text-neutral-400 hover:text-green-400">Reviews</Link></li>
            <li><Link to="/bundles" className="text-neutral-400 hover:text-green-400">Bundles & Combos</Link></li>
            <li><Link to="/blog" className="text-neutral-400 hover:text-green-400">Blog</Link></li>
            <li><Link to="/pricing" className="text-neutral-400 hover:text-green-400">Pricing</Link></li>
            <li><Link to="/faq" className="text-neutral-400 hover:text-green-400">FAQ</Link></li>
            <li><Link to="/contact" className="text-neutral-400 hover:text-green-400">Free Estimate</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#161616] py-6">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-neutral-500">
          <div>© {new Date().getFullYear()} {COMPANY.name}. All rights reserved.</div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span>License: {COMPANY.licenseNumber}</span>
            <span className="hidden md:inline">•</span>
            <span>{COMPANY.insurance}</span>
            <span className="hidden md:inline">•</span>
            <span className="text-green-400/80">{COMPANY.guarantee}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

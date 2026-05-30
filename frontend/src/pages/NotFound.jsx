import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import SEO from '../components/SEO';

const NotFound = () => (
  <div className="min-h-[70vh] flex items-center">
    <SEO title="Page Not Found | Maintain It Bandits LLC" description="The page you were looking for doesn’t exist." path="/404"/>
    <div className="max-w-2xl mx-auto px-5 text-center py-20">
      <div className="text-green-400 font-mono text-7xl md:text-9xl font-bold">404</div>
      <h1 className="font-serif text-3xl md:text-5xl text-white mt-4">Page Not Found</h1>
      <p className="text-neutral-400 mt-4 leading-relaxed">Sorry, the page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you back to something useful.</p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
        <Link to="/" className="btn-green inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold"><Home size={16}/> Go Home</Link>
        <Link to="/services" className="btn-dark inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold"><ArrowLeft size={16}/> Browse Services</Link>
      </div>
    </div>
  </div>
);

export default NotFound;

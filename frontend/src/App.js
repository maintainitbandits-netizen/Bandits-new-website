import React, { useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import StickyCallButton from './components/StickyCallButton';
import ExitIntent from './components/ExitIntent';
import PromoBanner from './components/PromoBanner';
import Home from './pages/Home';
import ServicesPage from './pages/ServicesPage';
import ServiceDetail from './pages/ServiceDetail';
import ServiceCityDetail from './pages/ServiceCityDetail';
import ServiceAreas from './pages/ServiceAreas';
import ServiceAreaDetail from './pages/ServiceAreaDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import Gallery from './pages/Gallery';
import Pricing from './pages/Pricing';
import FAQ from './pages/FAQ';
import NotFound from './pages/NotFound';
import Reviews from './pages/Reviews';
import Bundles from './pages/Bundles';
import BundleDetail from './pages/BundleDetail';
import { Toaster } from './components/ui/toaster';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);
  return null;
}

function App() {
  return (
    <HelmetProvider>
      <div className="App">
        <BrowserRouter>
          <ScrollToTop />
          <PromoBanner />
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/services/:slug" element={<ServiceDetail />} />
            <Route path="/services/:slug/:city" element={<ServiceCityDetail />} />
            <Route path="/service-areas" element={<ServiceAreas />} />
            <Route path="/service-areas/:slug" element={<ServiceAreaDetail />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/bundles" element={<Bundles />} />
            <Route path="/bundles/:slug" element={<BundleDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Footer />
          <StickyCallButton />
          <ExitIntent />
          <Toaster />
          <SpeedInsights />
        </BrowserRouter>
      </div>
    </HelmetProvider>
  );
}

export default App;

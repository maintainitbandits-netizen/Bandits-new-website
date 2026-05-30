import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Phone, Menu, X, ChevronDown } from 'lucide-react';
import { COMPANY, NAV_LINKS, SERVICES, SERVICE_AREAS } from '../mock';

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [svcOpen, setSvcOpen] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const location = useLocation();

  React.useEffect(() => { setOpen(false); setSvcOpen(false); setAreaOpen(false); }, [location.pathname]);

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-green-500 to-green-700 grid place-items-center text-[#0a0a0a] font-bold ring-2 ring-green-500/30">
            MB
          </div>
          <div className="leading-tight">
            <div className="text-green-400 font-bold text-base md:text-lg">{COMPANY.name}</div>
            <div className="text-[10px] tracking-[0.25em] text-neutral-400">{COMPANY.tagline}</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            l.hasDropdown === 'services' ? (
              <div key={l.path} className="relative" onMouseEnter={() => setSvcOpen(true)} onMouseLeave={() => setSvcOpen(false)}>
                <NavLink to={l.path} className={({ isActive }) => `px-4 py-2 rounded-full text-sm flex items-center gap-1 ${isActive ? 'bg-[#161616] text-white' : 'text-neutral-300 hover:text-white'}`}>
                  {l.label} <ChevronDown size={14} />
                </NavLink>
                {svcOpen && (
                  <div className="absolute top-full left-0 pt-2 w-72">
                    <div className="bg-[#0f0f0f] border border-[#222] rounded-xl shadow-2xl overflow-hidden">
                      {SERVICES.map(s => (
                        <Link key={s.slug} to={`/services/${s.slug}`} className="block px-4 py-3 text-sm text-neutral-300 hover:bg-[#171717] hover:text-green-400 border-b border-[#1a1a1a] last:border-0">{s.title}</Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : l.hasDropdown === 'areas' ? (
              <div key={l.path} className="relative" onMouseEnter={() => setAreaOpen(true)} onMouseLeave={() => setAreaOpen(false)}>
                <NavLink to={l.path} className={({ isActive }) => `px-4 py-2 rounded-full text-sm flex items-center gap-1 ${isActive ? 'bg-[#161616] text-white' : 'text-neutral-300 hover:text-white'}`}>
                  {l.label} <ChevronDown size={14} />
                </NavLink>
                {areaOpen && (
                  <div className="absolute top-full left-0 pt-2 w-64">
                    <div className="bg-[#0f0f0f] border border-[#222] rounded-xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto">
                      {SERVICE_AREAS.map(a => (
                        <Link key={a.slug} to={`/service-areas/${a.slug}`} className="block px-4 py-3 text-sm text-neutral-300 hover:bg-[#171717] hover:text-green-400 border-b border-[#1a1a1a] last:border-0">{a.name}</Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <NavLink key={l.path} to={l.path} end={l.path === '/'} className={({ isActive }) => `px-4 py-2 rounded-full text-sm ${isActive ? 'bg-[#161616] text-white' : 'text-neutral-300 hover:text-white'}`}>
                {l.label}
              </NavLink>
            )
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <a href={`tel:${COMPANY.phoneRaw}`} className="flex items-center gap-2 text-neutral-200 text-sm hover:text-green-400">
            <Phone size={16} className="text-green-400" /> {COMPANY.phone}
          </a>
          <Link to="/contact" className="btn-green px-5 py-2.5 rounded-full text-sm font-semibold">Free Estimate</Link>
        </div>

        <button className="lg:hidden text-neutral-200" onClick={() => setOpen(!open)}>
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-[#0c0c0c] border-t border-[#1a1a1a]">
          <div className="px-5 py-4 flex flex-col gap-1">
            {NAV_LINKS.map(l => (
              <NavLink key={l.path} to={l.path} end={l.path === '/'} className={({isActive}) => `px-4 py-3 rounded-lg ${isActive ? 'bg-[#161616] text-green-400' : 'text-neutral-300'}`}>
                {l.label}
              </NavLink>
            ))}
            <a href={`tel:${COMPANY.phoneRaw}`} className="px-4 py-3 text-green-400 flex items-center gap-2"><Phone size={16} /> {COMPANY.phone}</a>
            <Link to="/contact" className="btn-green text-center px-5 py-3 rounded-full font-semibold mt-2">Free Estimate</Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;

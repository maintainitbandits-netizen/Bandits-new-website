import React from 'react';
import { Facebook, Instagram, Star, MapPin as Map } from 'lucide-react';
import { SOCIAL } from '../config/social';

// Google "G" icon (since lucide doesn't have one)
const GoogleIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23zM5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84zM12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

const SocialIcons = ({ className = '' }) => {
  const items = [
    { url: SOCIAL.googleBusinessProfile, icon: GoogleIcon, label: 'Google Business Profile' },
    { url: SOCIAL.facebook, icon: Facebook, label: 'Facebook' },
    { url: SOCIAL.instagram, icon: Instagram, label: 'Instagram' },
    { url: SOCIAL.yelp, icon: Star, label: 'Yelp' },
    { url: SOCIAL.nextdoor, icon: Map, label: 'Nextdoor' },
  ].filter(i => !!i.url);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {items.map((s, i) => {
        const Icon = s.icon;
        return (
          <a key={i} href={s.url} target="_blank" rel="me noopener noreferrer" aria-label={s.label} className="h-9 w-9 rounded-full bg-[#0f0f0f] border border-[#222] grid place-items-center text-neutral-400 hover:text-green-400 hover:border-green-500/40 transition-colors">
            <Icon size={16}/>
          </a>
        );
      })}
    </div>
  );
};

export default SocialIcons;

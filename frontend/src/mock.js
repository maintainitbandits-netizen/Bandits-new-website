// Mock data for Maintain It Bandits LLC clone

export const COMPANY = {
  name: 'Maintain It Bandits LLC',
  tagline: 'CLEAN SPACES \u00b7 HEALTHY PLACES',
  category: 'Lawn Care Service',
  logo: 'https://customer-assets.emergentagent.com/job_bandits-replica/artifacts/46mb1ori_1B8C2EE3-.png',
  // NAP \u2014 matches Google Business Profile for local SEO consistency
  phone: '(904) 624-2706',
  phoneRaw: '9046242706',
  email: 'info@maintainitbandits.com',
  hours: 'Mon\u2013Fri: 7:00 AM \u2013 5:00 PM \u00b7 Sat: 9:00 AM \u2013 5:00 PM',
  hoursStructured: [
    { day: 'Monday', open: '07:00', close: '17:00' },
    { day: 'Tuesday', open: '07:00', close: '17:00' },
    { day: 'Wednesday', open: '07:00', close: '17:00' },
    { day: 'Thursday', open: '07:00', close: '17:00' },
    { day: 'Friday', open: '07:00', close: '17:00' },
    { day: 'Saturday', open: '09:00', close: '17:00' },
    { day: 'Sunday', open: null, close: null },
  ],
  area: 'Austin TX & Surrounding Areas',
  city: 'Austin',
  region: 'TX',
  country: 'US',
};

export const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Services', path: '/services', hasDropdown: 'services' },
  { label: 'Service Areas', path: '/service-areas', hasDropdown: 'areas' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'Blog', path: '/blog' },
  { label: 'About', path: '/about' },
  { label: 'Contact', path: '/contact' },
];

export const SERVICES = [
  {
    slug: 'lawn-mowing',
    title: 'Lawn Mowing & Maintenance',
    short: 'Weekly & bi-weekly lawn mowing, edging, blowing, and trimming to keep your Austin TX property looking pristine year-round.',
    image: 'https://images.unsplash.com/photo-1458245201577-fc8a130b8829?w=1200&q=80',
    description: 'Our lawn mowing and maintenance services are designed to keep your property looking its best year-round. We use professional-grade equipment and proven techniques to deliver a clean, even cut every time. Our team pays attention to the details - from precise edging along walkways to careful trimming around obstacles.',
    included: [
      'Weekly or bi-weekly mowing schedules',
      'Professional-grade equipment',
      'Precise edging and trimming',
      'Grass clipping cleanup',
      'Seasonal height adjustments',
      'Stripe patterns available',
    ],
    benefits: [
      'Consistent, professional appearance',
      'Healthier lawn growth',
      'Time savings for you',
      'Curb appeal improvement',
      'Flexible scheduling options',
    ],
  },
  {
    slug: 'landscaping',
    title: 'Landscaping & Design',
    short: 'Custom landscape design, garden bed installation, mulching, and hardscaping to transform your outdoor space in Austin TX.',
    image: 'https://images.unsplash.com/photo-1738193830098-2d92352a1856?w=1200&q=80',
    description: 'Transform your outdoor space with our complete landscape design and installation services. From native plant gardens to hardscaping features, we create beautiful, low-maintenance landscapes tailored to the Austin climate.',
    included: [
      'Custom landscape design',
      'Garden bed installation',
      'Mulching & ground cover',
      'Hardscaping & stonework',
      'Native plant selection',
      'Irrigation planning',
    ],
    benefits: [
      'Increased property value',
      'Low maintenance solutions',
      'Water-wise designs',
      'Year-round curb appeal',
      'Custom to your style',
    ],
  },
  {
    slug: 'fertilization',
    title: 'Fertilization & Weed Control',
    short: 'Seasonal fertilization programs and targeted weed control to keep your Austin lawn green, healthy, and weed-free.',
    image: 'https://images.unsplash.com/photo-1533460004989-cef01064af7e?w=1200&q=80',
    description: 'A healthy lawn starts with proper nutrition and weed management. Our seasonal fertilization programs are tailored to Austin\u2019s climate and grass types, ensuring lush, green growth all year long.',
    included: [
      'Custom fertilization programs',
      'Pre-emergent weed control',
      'Post-emergent treatments',
      'Soil pH testing',
      'Grub & pest prevention',
      'Seasonal applications',
    ],
    benefits: [
      'Greener, thicker lawn',
      'Fewer weeds',
      'Stronger root system',
      'Drought resistance',
      'Long-term lawn health',
    ],
  },
  {
    slug: 'sod-installation',
    title: 'Sod Installation',
    short: 'Fresh sod installation with premium grass varieties suited for Austin TX climate \u2014 Bermuda, St. Augustine, and Zoysia.',
    image: 'https://images.unsplash.com/photo-1734079692079-aae7e24a7035?w=1200&q=80',
    description: 'Get an instant lawn with our professional sod installation service. We prepare the soil, install fresh sod, and provide care instructions so your new lawn thrives from day one.',
    included: [
      'Site preparation & grading',
      'Premium sod varieties',
      'Bermuda, St. Augustine, Zoysia',
      'Soil amendment',
      'Installation & rolling',
      'Aftercare guidance',
    ],
    benefits: [
      'Instant green lawn',
      'Erosion control',
      'Increased property value',
      'Varieties for shade or sun',
      'Professional results',
    ],
  },
  {
    slug: 'property-maintenance',
    title: 'Property Maintenance',
    short: 'Comprehensive residential and commercial property maintenance for Austin TX \u2014 keeping your entire property in top shape.',
    image: 'https://images.pexels.com/photos/28463539/pexels-photo-28463539.jpeg?w=1200&q=80',
    description: 'From residential homes to commercial properties, we provide comprehensive maintenance services that keep every part of your property looking great and functioning properly.',
    included: [
      'Residential maintenance',
      'Commercial property care',
      'Seasonal cleanups',
      'Tree & shrub trimming',
      'Leaf removal',
      'Storm cleanup',
    ],
    benefits: [
      'One company for all needs',
      'Consistent appearance',
      'Reduced ownership stress',
      'Preventative care',
      'Reliable scheduling',
    ],
  },
  {
    slug: 'cleaning',
    title: 'Cleaning Services',
    short: 'Move-in cleaning, move-out cleaning, and rodent feces cleanup services for Austin TX homes. Thorough, safe, and reliable.',
    image: 'https://images.pexels.com/photos/6197116/pexels-photo-6197116.jpeg?w=1200&q=80',
    description: 'Our professional cleaning services are perfect for move-in/move-out situations and specialty cleanups. We handle the dirty work so you can focus on what matters.',
    included: [
      'Move-in cleaning',
      'Move-out cleaning',
      'Deep cleaning',
      'Rodent feces cleanup',
      'Kitchen & bathroom focus',
      'Eco-friendly products',
    ],
    benefits: [
      'Spotless results',
      'Safe sanitization',
      'Time-saving',
      'Stress-free moves',
      'Trusted professionals',
    ],
  },
];

export const SERVICE_AREAS = [
  { slug: 'austin', name: 'Austin TX' },
  { slug: 'round-rock', name: 'Round Rock TX' },
  { slug: 'cedar-park', name: 'Cedar Park TX' },
  { slug: 'georgetown', name: 'Georgetown TX' },
  { slug: 'pflugerville', name: 'Pflugerville TX' },
  { slug: 'leander', name: 'Leander TX' },
  { slug: 'bee-cave', name: 'Bee Cave TX' },
  { slug: 'west-lake-hills', name: 'West Lake Hills TX' },
  { slug: 'lakeway', name: 'Lakeway TX' },
  { slug: 'dripping-springs', name: 'Dripping Springs TX' },
];

export const TESTIMONIALS = [
  {
    text: 'Maintain It Bandits LLC transformed our yard completely! Their lawn mowing service is always on time and our grass has never looked better. Best lawn care in Austin!',
    name: 'Sarah M.',
    location: 'West Austin, TX',
  },
  {
    text: 'We switched from another Austin lawn service and the difference is night and day. Professional, reliable, and they actually care about doing quality work.',
    name: 'James R.',
    location: 'Round Rock, TX',
  },
  {
    text: 'Their landscaping design completely transformed our backyard. The team was knowledgeable about Austin-native plants and created something beautiful and low-maintenance.',
    name: 'Maria L.',
    location: 'Cedar Park, TX',
  },
];

export const HERO_IMAGE = 'https://images.unsplash.com/photo-1734303023491-db8037a21f09?w=1920&q=80';
export const AUSTIN_SKYLINE = 'https://images.unsplash.com/photo-1666969565832-b55bf42a900d?w=1200&q=80';
export const TEAM_IMAGE = 'https://images.pexels.com/photos/6647052/pexels-photo-6647052.jpeg?w=1200&q=80';

export const WHY_CHOOSE = [
  'Licensed & insured for your peace of mind',
  'Reliable, on-time service every visit',
  'Consistent 5-star reviews from Austin homeowners',
  'Eco-friendly practices & Austin-native expertise',
  'Water-wise solutions for Central Texas climate',
  'Full-service \u2014 lawn care, landscaping, cleaning & more',
];

export const VALUES = [
  { title: 'Reliability', text: 'We show up on time, every time. You can count on us to deliver consistent, dependable service.' },
  { title: 'Quality', text: 'We never cut corners. Every job is completed to the highest standards with attention to detail.' },
  { title: 'Customer Focus', text: 'Your satisfaction is our priority. We listen, adapt, and go above and beyond to exceed expectations.' },
  { title: 'Community', text: "We're proud to be part of the Austin community and committed to making our neighborhoods beautiful." },
  { title: 'Sustainability', text: 'We use eco-friendly practices and products whenever possible to protect our environment.' },
  { title: 'Efficiency', text: 'We respect your time and property, completing work efficiently without sacrificing quality.' },
];

export const STATS = [
  { value: '500+', label: 'Happy Customers' },
  { value: '5', label: 'Star Rating' },
  { value: '12+', label: 'Service Areas' },
  { value: '7', label: 'Days a Week' },
];

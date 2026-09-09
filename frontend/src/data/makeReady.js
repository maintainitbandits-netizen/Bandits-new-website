// Make Ready & Tenant Turnover hub page data — pillar page for the
// landlord / property manager vertical. Keep pricing as "typical ranges"
// and adjust to actual rates before publishing.

export const MAKE_READY_PACKAGES = [
  {
    slug: 'refresh',
    name: 'Refresh Make Ready',
    price: '$295+',
    unit: 'per unit',
    tagline: 'Light turns for well-kept units',
    best: 'Best for units left in good condition with a new lease already signed',
    features: [
      'Full move-out deep cleaning',
      'Kitchen & bathroom sanitizing',
      'Appliance clean-out (oven, fridge, dishwasher)',
      'Floors, baseboards, windows & blinds',
      'Light scuff & nail-hole touch-ups',
      'Debris bagging & removal',
      'Photo report of completed work',
    ],
  },
  {
    slug: 'standard',
    name: 'Standard Make Ready',
    price: '$550–$950',
    unit: 'per unit',
    tagline: 'Our most popular turn',
    badge: 'Most Popular',
    best: 'Best for typical move-outs that need cleaning, touch-ups, and curb appeal',
    features: [
      'Everything in the Refresh package',
      'Junk & belongings haul-off left by tenant',
      'Paint touch-ups throughout the unit',
      'Minor repairs & fixture replacements',
      'Full lawn mow, edging & bed cleanup',
      'Pressure wash entry, patio & driveway',
      '2–4 business day turnaround',
    ],
  },
  {
    slug: 'full-turn',
    name: 'Full Turnover',
    price: '$1,200–$2,500+',
    unit: 'per unit',
    tagline: 'Complete gut-to-gleam turn',
    best: 'Best for rough move-outs, long-term tenants, or full repositioning',
    features: [
      'Everything in the Standard package',
      'Full interior repaint coordination',
      'Repair punch-list completion',
      'Carpet cleaning / floor care coordination',
      'Deep landscape refresh & mulch',
      'Full exterior pressure washing',
      'Priority scheduling & rush turnaround available',
    ],
  },
];

export const MAKE_READY_CHECKLIST = [
  {
    title: 'Interior Deep Clean',
    items: [
      'Kitchen & appliances detailed (oven, fridge, dishwasher)',
      'Bathrooms sanitized top to bottom',
      'Floors swept, mopped & vacuumed',
      'Windows, sills, blinds & baseboards',
      'Inside cabinets, closets & drawers',
      'Ceiling fans, vents & light fixtures',
    ],
  },
  {
    title: 'Paint & Finishes',
    items: [
      'Scuff, nail-hole & mark touch-ups',
      'Wall & trim spot painting',
      'Full repaint coordination when needed',
      'Door & cabinet hardware check',
      'Smoke detector & filter checks',
      'Blind & fixture replacement as needed',
    ],
  },
  {
    title: 'Repairs & Punch List',
    items: [
      'Minor plumbing fixes (faucets, flappers, drains)',
      'Caulk refresh in kitchens & baths',
      'Drywall patching',
      'Door & cabinet adjustments',
      'Fixture & switchplate replacement',
      'Punch-list items from your scope sheet',
    ],
  },
  {
    title: 'Haul-Off & Reset',
    items: [
      'Tenant junk, trash & belongings removed',
      'Donation drop-off coordination',
      'Blind/floor protection during work',
      'Key & lock re-key coordination',
      'Final walk-through with photo report',
      'Unit left listing-photo ready',
    ],
  },
  {
    title: 'Curb Appeal & Exterior',
    items: [
      'Lawn mowed, trimmed & edged',
      'Flower bed cleanup & weeding',
      'Driveway, walkway & patio pressure washed',
      'Entry & porch detailed',
      'Fence & gate checks',
      'Fresh mulch available on request',
    ],
  },
  {
    title: 'Reporting & Billing',
    items: [
      'Before & after photos of every line item',
      'Itemized written scope before work starts',
      'COI (certificate of insurance) available',
      'Net-terms invoicing for property managers',
      'One invoice for the entire turn',
      'Recurring portfolio scheduling',
    ],
  },
];

export const TURN_TIMELINE = [
  { step: 'Day 0', title: 'Move-Out Assessment', text: 'Keys come back, we walk the unit, and you get a written itemized scope with flat pricing the same day.' },
  { step: 'Day 1', title: 'Haul-Off & Deep Clean', text: 'Everything the tenant left is removed and the full interior deep clean begins.' },
  { step: 'Day 2–3', title: 'Repairs & Paint', text: 'Punch-list repairs, caulk, and paint touch-ups are completed while floors dry.' },
  { step: 'Day 3–4', title: 'Exterior Refresh', text: 'Lawn, beds, and pressure washing make the listing photos and showings shine.' },
  { step: 'Rent-Ready', title: 'Final Walk-Through', text: 'You get a photo report on every line item. List it, show it, lease it.' },
];

export const MAKE_READY_AUDIENCES = [
  { title: 'Independent Landlords', text: 'You own one to a handful of rentals around Austin. You do not have a maintenance staff \u2014 you have us. One call turns the unit, and photo reports keep your records clean.' },
  { title: 'Property Managers', text: 'You manage doors, not vendors. We work from your scope sheets, reserve month-end capacity, carry your COI requirements, and invoice on net terms.' },
  { title: 'Realtors & Investors', text: 'Listing a rental or prepping a recently acquired property? A fresh make ready means better photos, faster leases, and stronger offers.' },
  { title: 'STR & Mid-Term Hosts', text: 'Turning an Airbnb or furnished mid-term rental between guests? We reset the unit and the curb appeal so your reviews stay five stars.' },
];

export const MAKE_READY_TESTIMONIALS = [
  { text: 'Our turnovers used to take two weeks of chasing contractors. Bandits turned 4 units in Round Rock in 3 days each \u2014 with photos for the owners. They are on every move-out now.', name: 'Danielle P.', location: 'Property Manager, Round Rock' },
  { text: 'Tenant left a garage full of junk and the yard a mess. One crew hauled it, cleaned it, touched up paint, and made the lawn look showable. New tenant signed 6 days later.', name: 'Marcus T.', location: 'Landlord, Austin' },
  { text: 'I manage 60+ doors and the month-end rush used to be a nightmare. Their team reserved capacity for my move-outs and every unit came back photo-verified and rent-ready.', name: 'Alicia R.', location: 'Portfolio Manager, Cedar Park' },
];

export const MAKE_READY_FAQS = [
  { q: 'What is the difference between a make ready and a turnover service?', a: 'They overlap heavily. A make ready focuses on getting the unit itself rent-ready (cleaning, paint, repairs). A turnover service covers the entire move-out-to-move-in process \u2014 including haul-off and exterior work. We bundle both into one coordinated service so you never have to split the job.' },
  { q: 'How much do make ready and turnover services cost in Austin?', a: 'Typical ranges: Refresh make readys start around $295 per unit, Standard make readys run $550\u2013$950, and Full turnovers with paint and repairs run $1,200\u2013$2,500+. Every estimate is free and itemized before we start.' },
  { q: 'How fast can you turn a unit?', a: 'Most turns finish in 2\u20134 business days from move-out. Rush 24\u201348 hour turnarounds are available when a new lease is already signed \u2014 we build the schedule backward from your deadline.' },
  { q: 'Do you handle multiple units and month-end volume?', a: 'Yes. Property managers reserve recurring monthly capacity so simultaneous move-outs are all covered. Volume pricing applies for portfolios.' },
  { q: 'Do you provide photo documentation?', a: 'Every job ends with a before-and-after photo report for each line item \u2014 ready for owner reporting, file storage, or security-deposit documentation.' },
  { q: 'Can you work from our make-ready checklist?', a: 'Absolutely. We follow your standard scope sheet, or we can build one with you and apply it to every unit for consistent results.' },
  { q: 'Are you licensed and insured for property management work?', a: 'Yes \u2014 Maintain It Bandits LLC is fully licensed and insured, with general liability and workers\u2019 compensation. We can name your company on our COI.' },
  { q: 'Which areas do you serve?', a: 'Austin, Round Rock, Cedar Park, Georgetown, Pflugerville, Leander, Hutto, Taylor, Bee Cave, Lakeway, West Lake Hills, Dripping Springs, and surrounding Central Texas communities.' },
];

// Questions for a useful quote, tailored to the service rather than borrowed
// from a city's lawn-care introduction. These are examples, not fixed scope.
export const SERVICE_CITY_REQUEST_DETAILS = {
  'lawn-mowing': 'Share the approximate lawn size, the mowing and edging you need, and your preferred schedule.',
  'landscaping': 'Tell us about the outdoor space, your planting or landscape ideas, and any materials you have in mind.',
  'fertilization': 'Share your grass type, lawn concerns, and any past treatments. Ask about product options and label instructions.',
  'sod-installation': 'Describe the lawn size, current condition, sun and shade, and the grass you are considering.',
  'property-maintenance': 'Tell us what needs attention around the property and whether you are considering one-time or ongoing work.',
  'cleaning': 'Share the rooms, property condition, and whether you need move-in, move-out, or deep cleaning.',
  'mulching': 'Describe your garden beds, their approximate size, and the type of mulch you have in mind.',
  'shrub-trimming': 'Tell us about the shrubs or hedges, their approximate size, and whether you need trimmings removed.',
  'flower-bed-planting': 'Share the bed size, sun exposure, and your planting or design goals.',
  'seasonal-cleanup': 'Describe the leaves, overgrowth, yard debris, and areas you would like cleared.',
  'yard-work': 'List the mowing, raking, trimming, or other yard tasks you would like to discuss.',
  'mulch-rock-installation': 'Share the area dimensions, existing ground cover, and the mulch or decorative rock you have in mind.',
  'junk-haul-off': 'Describe the items or brush, the approximate amount, and where the material is located.',
  'pressure-washing': 'Tell us which outdoor surfaces need cleaning and mention any delicate materials or access concerns.',
};

export const serviceCityIntro = (service, city) => {
  const details = SERVICE_CITY_REQUEST_DETAILS[service.slug] || 'Tell us about your property and the work you have in mind.';
  return `Looking for ${service.title.toLowerCase()} in ${city.fullName}? ${details} We can discuss the work, a quote, and availability.`;
};

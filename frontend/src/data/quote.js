import { SERVICES, SERVICE_AREAS } from '../mock';
import { MAKE_READY_AREAS } from './makeReady';

export const FORMSPREE_ENDPOINT = 'https://formspree.io/f/maqkbaql';
export const RENTAL_SLUGS = ['make-ready-services', 'tenant-turnover-services'];
export const RENTAL_CITIES = MAKE_READY_AREAS.map(area => ({ ...area, name: `${area.name} TX` }));
export const PROPERTY_TYPES = ['Residential Home', 'Townhome / Condo', 'Commercial Property'];
export const RENTAL_PROPERTY_TYPES = [...PROPERTY_TYPES, 'Apartment / Multi-Unit', 'Other'];

export const isRentalService = title => SERVICES.some(s => RENTAL_SLUGS.includes(s.slug) && s.title === title);

export function initialQuote(search = '') {
  const params = new URLSearchParams(search);
  const service = SERVICES.find(s => s.slug === params.get('service'));
  const isRental = service && RENTAL_SLUGS.includes(service.slug);
  const cities = isRental ? RENTAL_CITIES : SERVICE_AREAS;
  const city = cities.find(c => c.slug === params.get('city'));
  return {
    service: service?.title || '', city: city?.name || '', customCity: '', propertyType: '',
    propertyAddress: '', customerRole: '', units: '', desiredDate: '', name: '', email: '', phone: '', message: '',
  };
}

// Keep existing non-rental choices intact; extra cities only apply to rental requests.
export function updateQuoteField(previous, key, value) {
  const next = { ...previous, [key]: value };
  if (key === 'service' && !isRentalService(value)) {
    if (!SERVICE_AREAS.some(area => area.name === previous.city)) next.city = '';
    if (!PROPERTY_TYPES.includes(previous.propertyType)) next.propertyType = '';
    next.customCity = '';
  }
  return next;
}

export function quotePayload(form, source) {
  const rental = isRentalService(form.service);
  const city = form.city === 'Other' ? form.customCity.trim() : form.city;
  const payload = {
    name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
    service: form.service, message: form.message,
    _subject: `New Quote Request — ${form.service || 'General'}${city ? ` in ${city}` : ''}`,
    source,
  };
  if (source === 'multi-step quote' || rental) {
    payload.city = city;
    payload.propertyType = form.propertyType;
  }
  if (rental) {
    payload.propertyAddress = form.propertyAddress.trim();
    payload.customerRole = form.customerRole;
    payload.units = form.units;
    payload.desiredDate = form.desiredDate;
  }
  return payload;
}

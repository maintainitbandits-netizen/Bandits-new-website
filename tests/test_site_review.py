"""Regressions for the no-email calendar and service/content review."""

import json
import re
import unittest
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'frontend'
SRC = FRONTEND / 'src'
PUBLIC = FRONTEND / 'public'
GUIDE = '/guides/austin-lawn-care-calendar.html'
PDF = '/guides/austin-lawn-care-calendar.pdf'
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December']


class GuideParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.h3s, self.links, self.inputs, self.forms, self.scripts = [], [], [], 0, 0
        self.canonical = None
        self._h3 = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h3':
            self._h3 = True
        if tag == 'a':
            self.links.append(attrs.get('href'))
        if tag == 'input':
            self.inputs.append(attrs)
        if tag == 'form':
            self.forms += 1
        if tag == 'script':
            self.scripts += 1
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical = attrs.get('href')

    def handle_data(self, data):
        if self._h3:
            self.h3s.append(data.strip())

    def handle_endtag(self, tag):
        if tag == 'h3':
            self._h3 = False


class CalendarReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((SRC / 'data/lawnCalendar.json').read_text(encoding='utf-8'))
        cls.html = (PUBLIC / GUIDE.lstrip('/')).read_text(encoding='utf-8')
        cls.parsed = GuideParser()
        cls.parsed.feed(cls.html)
        cls.pdf = (PUBLIC / PDF.lstrip('/')).read_bytes()

    def test_twelve_months_and_sources_exist_in_both_public_formats(self):
        months = [month for season in self.data['seasons'] for month in season['months']]
        self.assertEqual([m['name'] for m in months], MONTHS)
        self.assertTrue(all(m['focus'] and len(m['tasks']) >= 3 for m in months))
        self.assertEqual(self.parsed.h3s, MONTHS)
        self.assertTrue(self.pdf.startswith(b'%PDF-'))
        self.assertGreater(len(self.pdf), 5000)
        self.assertEqual(len(re.findall(rb'/Type /Page\b', self.pdf)), 4)
        for source in self.data['sources']:
            self.assertTrue(source['url'].startswith('https://'))
            self.assertIn(source['url'], self.parsed.links)
            self.assertIn(source['url'].encode(), self.pdf)
        self.assertIn('https://www.austintexas.gov/water/find-your-watering-day', self.parsed.links)

    def test_guide_is_publicly_indexable_and_requires_no_email(self):
        magnet = (SRC / 'components/LeadMagnet.jsx').read_text(encoding='utf-8')
        self.assertIn(f'href="{PDF}" download', magnet)
        self.assertIn(f'href="{GUIDE}"', magnet)
        self.assertNotIn('formspree', magnet.lower())
        self.assertNotIn('<form', magnet.lower())
        self.assertEqual(self.parsed.forms, 0)
        self.assertEqual(self.parsed.inputs, [])
        self.assertEqual(self.parsed.scripts, 0)
        self.assertIn(PDF, self.parsed.links)
        canonical = 'https://www.maintainitbandits.com' + GUIDE
        self.assertEqual(self.parsed.canonical, canonical)
        sitemap = ET.parse(PUBLIC / 'sitemap.xml')
        locations = [loc.text for loc in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertEqual(locations.count(canonical), 1)
        self.assertNotIn('noindex', self.html.lower())

    def test_water_and_treatment_guidance_is_conditional(self):
        self.assertIn('current local restrictions', self.data['notice'])
        self.assertIn('product labels', self.data['notice'])
        text = (SRC / 'seo.js').read_text(encoding='utf-8')
        self.assertIn('Re-entry times vary by product', text)
        self.assertIn('Do not sweep or vacuum rodent droppings', text)
        self.assertNotIn('typically twice daily', text)
        self.assertNotIn(r'typically 1\u20132 hours', text)
        self.assertNotIn('partner with certified arborists', text)
        faq = (SRC / 'pages/FAQ.jsx').read_text(encoding='utf-8')
        self.assertIn('Do not sweep or vacuum rodent droppings', faq)
        self.assertNotIn('HEPA vacuums', faq)
        blog = (SRC / 'data/blog.js').read_text(encoding='utf-8')
        for link in ('https://www.cdc.gov/healthy-pets/rodent-control/clean-up.html',
                     'https://www.austintexas.gov/water/find-your-watering-day', GUIDE):
            self.assertIn(link, blog)
        for old in ('requires twice-daily watering', 'Same-week availability', 'Apply pre-emergent by late February every year without fail'):
            self.assertNotIn(old, blog)


class ServiceCityReviewTests(unittest.TestCase):
    def test_every_non_rental_service_has_specific_request_guidance(self):
        mock = (SRC / 'mock.js').read_text(encoding='utf-8')
        services = set(re.findall(r"^\s{4}slug: '([^']+)',", mock, flags=re.MULTILINE))
        guidance = (SRC / 'data/serviceCity.js').read_text(encoding='utf-8')
        mapped = set(re.findall(r"^\s{2}'([^']+)':", guidance, flags=re.MULTILINE))
        self.assertEqual(services - {'make-ready-services', 'tenant-turnover-services'}, mapped)
        self.assertEqual(len(mapped), 14)
        for slug, keyword in [('cleaning', 'rooms'), ('pressure-washing', 'surfaces'),
                              ('junk-haul-off', 'items'), ('fertilization', 'product')]:
            line = next(line for line in guidance.splitlines() if line.startswith(f"  '{slug}':"))
            self.assertIn(keyword, line.lower())

    def test_template_preserves_rentals_quotes_and_correct_scope(self):
        page = (SRC / 'pages/ServiceCityDetail.jsx').read_text(encoding='utf-8')
        self.assertIn('serviceCityIntro(svc, cityMeta)', page)
        self.assertNotIn('cityMeta.intro', page)
        self.assertNotIn('cityMeta.landmarks', page)
        self.assertIn('<RentalCityDetail service={svc}', page)
        self.assertIn('`/contact?service=${slug}&city=${city}`', page)
        self.assertIn('Examples; the work is confirmed for your property.', page.replace('These are examples;', 'Examples;'))
        self.assertNotIn('lawn care ${cityMeta.name}', page)
        detail = (SRC / 'pages/ServiceDetail.jsx').read_text(encoding='utf-8')
        self.assertIn('Examples only; the work is confirmed for your property.', detail)

    def test_referenced_local_media_exists(self):
        missing = set()
        pattern = re.compile(r"[\"'](/(?:gallery|images|guides)/[^\"'?#]+\.(?:jpe?g|png|webp|svg|gif|pdf|html))[\"']", re.I)
        for path in SRC.rglob('*'):
            if path.suffix not in ('.js', '.jsx', '.json'):
                continue
            for url in pattern.findall(path.read_text(encoding='utf-8')):
                if not (PUBLIC / url.lstrip('/')).is_file():
                    missing.add(url)
        self.assertEqual(missing, set())


if __name__ == '__main__':
    unittest.main()

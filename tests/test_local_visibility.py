"""Regression checks for local-page accuracy and shared business identity."""

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'frontend/src'


class LocalVisibilityTests(unittest.TestCase):
    def test_unverified_business_volume_claims_are_not_in_public_app(self):
        # These older marketing figures have not been confirmed by the owner.
        forbidden = re.compile(r'500\+|2,500\+ jobs|6\+ years|hundreds of (?:Round Rock homeowners|yards)', re.I)
        matches = []
        for path in SRC.rglob('*'):
            if path.suffix not in {'.js', '.jsx', '.json'}:
                continue
            if forbidden.search(path.read_text(encoding='utf-8')):
                matches.append(str(path.relative_to(ROOT)))
        self.assertEqual(matches, [])

    def test_homepage_uses_the_existing_canonical_image_and_identity(self):
        config = (SRC / 'config/site.js').read_text()
        home = (SRC / 'pages/Home.jsx').read_text()
        self.assertIn("export const SITE_ORIGIN = 'https://www.maintainitbandits.com'", config)
        self.assertIn('BUSINESS_SCHEMA_ID', home)
        self.assertIn('image={HERO_IMAGE}', home)
        self.assertNotIn('hero-bg.jpg', home)
        self.assertTrue((ROOT / 'frontend/public/gallery/lush-lawn-after.jpg').is_file())
        self.assertIn('gallery/lush-lawn-after.jpg', (SRC / 'mock.js').read_text())

    def test_city_templates_reference_one_business_and_preserve_city_quote(self):
        area = (SRC / 'pages/ServiceAreaDetail.jsx').read_text()
        service_city = (SRC / 'pages/ServiceCityDetail.jsx').read_text()
        for template in (area, service_city):
            self.assertIn('BUSINESS_SCHEMA_ID', template)
            self.assertIn("'@type': 'Service'", template)
            self.assertIn('areaServed', template)
            self.assertNotIn('addressLocality: cityMeta.name', template)
            self.assertIn('<CTASection quoteLink={quoteLink} />', template)
        self.assertIn('`/contact?city=${slug}`', area)
        self.assertIn('`/contact?service=${slug}&city=${city}`', service_city)
        self.assertIn('<RentalCityDetail service={svc}', service_city)
        self.assertNotIn("'priceRange': '$$'", area)


if __name__ == '__main__':
    unittest.main()

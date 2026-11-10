"""Regression checks for public custom-quote content and service mappings."""

from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'frontend/src'


def read(path):
    return (SRC / path).read_text(encoding='utf-8')


class CustomQuoteContentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.calculator = read('components/QuoteCalculator.jsx')
        cls.pricing = read('pages/Pricing.jsx')
        cls.bundles = read('data/bundles.js')
        cls.blog = read('data/blog.js')
        mock_services = read('mock.js').split('export const SERVICES = [', 1)[1].split('export const SERVICE_AREAS', 1)[0]
        cls.service_slugs = set(re.findall(r"slug:\s*'([^']+)'", mock_services))

    def test_quote_content_has_no_unverified_amounts_or_discount_fields(self):
        for path in (
            'components/QuoteCalculator.jsx', 'pages/Home.jsx', 'pages/Pricing.jsx',
            'pages/Bundles.jsx', 'pages/BundleDetail.jsx', 'data/bundles.js', 'data/blog.js',
        ):
            with self.subTest(path=path):
                text = read(path)
                self.assertNotRegex(text, r'\$\s*\d')
                self.assertNotRegex(text, r'(?i)\b(?:save|savings|discount)\b[^\n]{0,30}\d')
                self.assertNotRegex(text, r'\b(?:regularPrice|bundlePrice|priceCurrency|priceRange|PriceSpecification)\b')
                self.assertNotRegex(text, r'(?i)instant (?:quote|estimate)|ballpark')
        self.assertNotIn('SERVICE_RATES', self.calculator)
        self.assertNotIn("'@type': 'Offer'", read('pages/BundleDetail.jsx'))
        self.assertIn("'@type': 'Service'", read('pages/BundleDetail.jsx'))

    def test_original_calculator_choices_and_all_services_remain_selectable(self):
        for label in ('Lawn Mowing', 'Sod Installation', 'Mulch Refresh',
                      'Landscape Design', 'Property Maintenance', 'Make Ready / Turnover'):
            with self.subTest(label=label):
                self.assertIn(label, self.calculator + read('mock.js'))
        self.assertIn('SERVICES.map', self.calculator)
        self.assertIn('Custom Make-Ready Quote', self.calculator)
        self.assertIn('`/contact?service=${selected.slug}`', self.calculator)
        self.assertTrue({'make-ready-services', 'tenant-turnover-services'} <= self.service_slugs)

    def test_pricing_and_all_six_bundles_link_to_known_services(self):
        self.assertIn('Make Ready &amp; Turnover Quotes', self.pricing)
        self.assertIn('MAKE_READY_PACKAGES.map', self.pricing)
        self.assertIn('examples to discuss', self.pricing.lower())
        bundle_slugs = re.findall(r"^\s+slug: '([^']+)'", self.bundles, re.M)
        bundle_services = re.findall(r"quoteService: '([^']+)'", self.bundles)
        self.assertEqual(len(bundle_slugs), 6)
        self.assertEqual(len(set(bundle_slugs)), 6)
        self.assertEqual(len(bundle_services), 6)
        self.assertTrue(set(bundle_services) <= self.service_slugs)
        self.assertEqual(self.bundles.count('customQuote: true'), 6)
        linked_services = re.findall(r"\b(?:service|slug): '([^']+)'", self.pricing)
        self.assertTrue(linked_services)
        self.assertTrue(set(linked_services) <= self.service_slugs)
        self.assertIn('Examples only', read('pages/BundleDetail.jsx'))

    def test_pricing_article_urls_and_helpful_guidance_remain(self):
        for slug in ('how-much-does-lawn-care-cost-austin-tx',
                     'how-much-does-house-cleaning-cost-austin-tx',
                     'move-out-cleaning-checklist-austin-tx'):
            with self.subTest(slug=slug):
                self.assertIn(f"slug: '{slug}'", self.blog)
        self.assertIn('Request a Custom Quote', self.blog)
        self.assertIn('/contact?service=cleaning', self.blog)
        self.assertIn('Cleaning alone does not guarantee the return of a deposit', self.blog)
        self.assertIn('cdc.gov/healthy-pets/rodent-control/clean-up.html', self.blog)

    def test_existing_free_guide_and_unrelated_quote_language_remain(self):
        # An offer of a free estimate is separate from an estimate of the service price.
        self.assertIn('Get Free Estimate', read('pages/ServiceDetail.jsx'))
        self.assertIn('Request a free quote', read('data/fallCleanupPost.json'))
        self.assertTrue((ROOT / 'frontend/public/guides/austin-lawn-care-calendar.pdf').is_file())
        self.assertTrue((ROOT / 'frontend/public/guides/austin-lawn-care-calendar.html').is_file())
        self.assertIn('no email address required', read('components/LeadMagnet.jsx').lower())


if __name__ == '__main__':
    unittest.main()

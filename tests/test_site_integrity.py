import json
import os
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SiteIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = json.loads((ROOT / 'vercel.json').read_text(encoding='utf-8'))
        cls.frontend_config = json.loads((ROOT / 'frontend/vercel.json').read_text(encoding='utf-8'))

    def test_redirects_run_before_spa_fallback(self):
        # Legacy routes can shadow the higher-level redirects. Rewrites run
        # after redirects and the filesystem, so the SPA remains a fallback.
        self.assertNotIn('routes', self.config)
        self.assertFalse(any(rule['source'].rstrip('/') == '/crm' for rule in self.config['redirects']))
        self.assertEqual(self.config['rewrites'], [
            {'source': '/_/backend/(.*)', 'destination': '/backend/server.py'},
            {'source': '/crm', 'destination': '/crm.html'},
            {'source': '/crm/', 'destination': '/crm.html'},
            {'source': '/(.*)', 'destination': '/index.html'},
        ])
        headers = self.config['headers']
        self.assertEqual(headers[0]['source'], '/(.*)')
        self.assertEqual({h['key']: h['value'] for h in headers[0]['headers']}, {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
        })
        for source in ('/crm', '/crm/', '/crm.html'):
            rule = next(rule for rule in headers if rule['source'] == source)
            values = {h['key']: h['value'] for h in rule['headers']}
            self.assertIn('noindex', values['X-Robots-Tag'])
            self.assertIn('no-store', values['Cache-Control'])

    def test_frontend_project_redirects_match_repository_config(self):
        self.assertNotIn('routes', self.frontend_config)
        self.assertEqual(self.frontend_config['redirects'], self.config['redirects'])
        rewrites = self.frontend_config['rewrites']
        self.assertEqual(rewrites[-1], {'source': '/(.*)', 'destination': '/index.html'})
        self.assertTrue(all(rule['source'] != '/(.*)' for rule in rewrites[:-1]))

    def test_retired_service_redirects_and_content_removal(self):
        redirects = [r for r in self.config['redirects'] if r['destination'] == '/services']
        self.assertEqual(len(redirects), 3)
        self.assertTrue(all(r['permanent'] is True for r in redirects))
        sources = {r['source'] for r in redirects}
        direct = [s for s in sources if s.startswith('/services/') and ':city' not in s]
        self.assertEqual(len(direct), 1)
        self.assertIn(direct[0] + '/:city*', sources)
        slug = direct[0].rsplit('/', 1)[-1]
        self.assertTrue(any(s.endswith('-' + slug) for s in sources))

        # Derive the retired term from its redirect, then check the whole
        # repository rather than hardcoding site content into this test.
        term = slug.split('-', 1)[0].casefold()
        allowed_configs = {ROOT / 'vercel.json', ROOT / 'frontend/vercel.json'}
        seen_configs = set()
        matches = []
        for directory, dirs, files in os.walk(ROOT):
            dirs[:] = [d for d in dirs if d not in {'.git', 'node_modules', 'build'}]
            for name in files:
                if name == 'package-lock.json':
                    continue
                file = Path(directory) / name
                try:
                    content = file.read_text(encoding='utf-8')
                except (UnicodeDecodeError, OSError):
                    continue
                if term not in content.casefold():
                    continue
                if file in allowed_configs:
                    seen_configs.add(file)
                    lines = [line for line in content.splitlines() if term in line.casefold()]
                    self.assertEqual(len(lines), 3)
                    self.assertTrue(all('"source"' in line for line in lines))
                else:
                    matches.append(str(file.relative_to(ROOT)))
        self.assertEqual(seen_configs, allowed_configs)
        self.assertEqual(matches, [])

    def test_make_ready_feature_is_intact(self):
        app = (ROOT / 'frontend/src/App.js').read_text(encoding='utf-8')
        mock = (ROOT / 'frontend/src/mock.js').read_text(encoding='utf-8')
        seo = (ROOT / 'frontend/src/seo.js').read_text(encoding='utf-8')
        blog = (ROOT / 'frontend/src/data/blog.js').read_text(encoding='utf-8')
        bundles = (ROOT / 'frontend/src/data/bundles.js').read_text(encoding='utf-8')
        self.assertTrue((ROOT / 'frontend/src/pages/MakeReadyHub.jsx').is_file())
        self.assertTrue((ROOT / 'frontend/src/data/makeReady.js').is_file())
        self.assertIn("import MakeReadyHub from './pages/MakeReadyHub';", app)
        self.assertIn('<Route path="/make-ready-turnovers" element={<MakeReadyHub />} />', app)

        services = ('make-ready-services', 'tenant-turnover-services')
        for service in services:
            self.assertIn(f"slug: '{service}'", mock)
            self.assertIn(f"'{service}': {{", seo)
        for post in ('austin-rental-make-ready-checklist-landlords',
                     'how-much-does-a-make-ready-cost-austin-tx',
                     'tenant-turnover-timeline-austin-tx'):
            self.assertIn(f"slug: '{post}'", blog)
        self.assertIn("slug: 'rapid-turnover'", bundles)

        sitemap = ET.parse(ROOT / 'frontend/public/sitemap.xml')
        locations = {e.text for e in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')}
        base = 'https://www.maintainitbandits.com'
        self.assertIn(base + '/make-ready-turnovers', locations)
        cities = ('austin', 'round-rock', 'cedar-park', 'georgetown', 'pflugerville',
                  'leander', 'bee-cave', 'west-lake-hills', 'lakeway',
                  'dripping-springs', 'hutto', 'taylor')
        for service in services:
            self.assertIn(f'{base}/services/{service}', locations)
            for city in cities:
                self.assertIn(f'{base}/services/{service}/{city}', locations)


if __name__ == '__main__':
    unittest.main()

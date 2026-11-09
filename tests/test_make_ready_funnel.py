"""Regression checks for the rental make-ready hub and its static snapshot."""

import json
import os
from html.parser import HTMLParser
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'frontend'
CONTENT = json.loads((FRONTEND / 'src/data/makeReadyContent.json').read_text())
ORIGIN = 'https://www.maintainitbandits.com'


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.metas, self.canonicals, self.schemas, self.links = {}, [], [], []
        self.text, self.title, self.schema = [], '', None
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            key = attrs.get('name') or attrs.get('property')
            self.metas.setdefault(key, []).append(attrs.get('content'))
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonicals.append(attrs.get('href'))
        if tag == 'a':
            self.links.append(attrs.get('href'))
        if tag == 'title':
            self.in_title = True
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.schema = ''

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.schema is not None:
            self.schema += data
        else:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        if tag == 'script' and self.schema is not None:
            self.schemas.append(json.loads(self.schema))
            self.schema = None


class MakeReadyFunnelTests(unittest.TestCase):
    def test_requested_areas_are_in_shared_content_without_new_city_pages(self):
        names = {a['name'] for a in CONTENT['areas']}
        self.assertTrue({'Austin', 'Hutto', 'Taylor', 'Round Rock', 'Pflugerville', 'Manor', 'Jarrell'} <= names)
        self.assertIn('about 50 miles', CONTENT['areaIntro'])
        self.assertIn('confirm', CONTENT['areaIntro'])
        locations = {e.text for e in ET.parse(FRONTEND / 'public/sitemap.xml').findall('.//{*}loc')}
        for area in CONTENT['areas']:
            for service in ('make-ready-services', 'tenant-turnover-services'):
                path = f"{ORIGIN}/services/{service}/{area['slug']}"
                self.assertEqual(path in locations, area['hasPage'], path)
        self.assertTrue((FRONTEND / 'src/pages/RentalCityDetail.jsx').is_file())
        city_page = (FRONTEND / 'src/pages/ServiceCityDetail.jsx').read_text()
        self.assertIn('<RentalCityDetail service={svc}', city_page)

    def test_frontend_rewrites_preserve_blog_crm_and_fallback(self):
        config = json.loads((FRONTEND / 'vercel.json').read_text())
        self.assertIn('node scripts/prerender-fall-cleanup.cjs', config['buildCommand'])
        self.assertIn('node scripts/prerender-make-ready.cjs', config['buildCommand'])
        rewrites = {rule['source']: rule['destination'] for rule in config['rewrites']}
        for source in ('/make-ready-turnovers', '/make-ready-turnovers/'):
            self.assertEqual(rewrites[source], '/_prerendered/make-ready-turnovers.html')
        self.assertEqual(rewrites['/crm'], '/crm.html')
        self.assertEqual(rewrites['/crm/'], '/crm.html')
        self.assertEqual(rewrites['/blog/fall-cleanup-austin-rental-properties'], '/_prerendered/fall-cleanup-austin-rental-properties.html')
        self.assertEqual(config['rewrites'][-1], {'source': '/(.*)', 'destination': '/index.html'})

    def test_snapshot_has_matching_content_metadata_links_and_no_fabricated_offer(self):
        with tempfile.TemporaryDirectory() as temp:
            shutil.copyfile(FRONTEND / 'public/index.html', Path(temp) / 'index.html')
            subprocess.run(['node', str(FRONTEND / 'scripts/prerender-make-ready.cjs')],
                           env={**os.environ, 'MAKE_READY_BUILD_DIR': temp}, check=True, capture_output=True, text=True)
            page = PageParser()
            page.feed((Path(temp) / '_prerendered/make-ready-turnovers.html').read_text())

        url = ORIGIN + '/make-ready-turnovers'
        self.assertEqual(page.title, CONTENT['meta']['title'])
        self.assertEqual(page.metas['description'], [CONTENT['meta']['description']])
        self.assertEqual(page.metas['og:title'], [CONTENT['meta']['title']])
        self.assertEqual(page.metas['og:url'], [url])
        self.assertEqual(page.metas['og:image'], [ORIGIN + CONTENT['meta']['image']])
        self.assertEqual(page.canonicals, [url])
        text = ' '.join(' '.join(page.text).split())
        self.assertIn(CONTENT['headline'], text)
        self.assertIn(CONTENT['intro'], text)
        self.assertIn(CONTENT['areaIntro'], text)
        for group in ('audiences', 'packages', 'checklist', 'timeline'):
            for item in CONTENT[group]:
                if 'title' in item:
                    self.assertIn(item['title'], text)
                if 'name' in item:
                    self.assertIn(item['name'], text)
        for faq in CONTENT['faqs']:
            self.assertIn(faq['q'], text)
            self.assertIn(faq['a'], text)
        self.assertIn('/contact?service=make-ready-services', page.links)
        self.assertIn('/services/tenant-turnover-services', page.links)
        for area in CONTENT['areas']:
            self.assertIn(f"{area['name']}, TX", text)
            self.assertEqual(f"/services/make-ready-services/{area['slug']}" in page.links, area['hasPage'])
        service = next(s for s in page.schemas if s.get('@id') == url + '#service')
        self.assertNotIn('offers', service)
        self.assertEqual(len(service['areaServed']), len(CONTENT['areas']))
        faq_schema = next(s for s in page.schemas if s.get('@type') == 'FAQPage')
        self.assertEqual([f['name'] for f in faq_schema['mainEntity']], [f['q'] for f in CONTENT['faqs']])
        self.assertEqual([f['acceptedAnswer']['text'] for f in faq_schema['mainEntity']], [f['a'] for f in CONTENT['faqs']])
        for unsupported in ('48–72', '$295', '127+', 'COI available', 'net-terms'):
            self.assertNotIn(unsupported, text)


if __name__ == '__main__':
    unittest.main()

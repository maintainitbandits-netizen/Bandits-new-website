import base64
import json
import re
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CRM = ROOT / 'frontend/public/crm.html'


class CRMParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.robots = []
        self.login_attributes = None
        self.elements = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta' and attrs.get('name', '').lower() == 'robots':
            self.robots.append(attrs.get('content', '').lower())
        if attrs.get('id'):
            self.elements[attrs['id']] = (tag, attrs)
        if attrs.get('id') == 'login':
            self.login_attributes = attrs


class CRMStaticTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = CRM.read_text(encoding='utf-8')
        cls.parser = CRMParser()
        cls.parser.feed(cls.source)
        cls.configs = [
            json.loads((ROOT / 'vercel.json').read_text(encoding='utf-8')),
            json.loads((ROOT / 'frontend/vercel.json').read_text(encoding='utf-8')),
        ]

    def test_supplied_static_page_has_auth_and_noindex(self):
        self.assertTrue(self.source.lstrip().lower().startswith('<!doctype html>'))
        self.assertTrue(self.source.rstrip().lower().endswith('</html>'))
        self.assertTrue(any('noindex' in content for content in self.parser.robots))
        self.assertIsNotNone(self.parser.login_attributes)
        self.assertNotIn('hidden', self.parser.login_attributes)
        self.assertIn('Team sign in', self.source)
        self.assertIn('signInWithPassword', self.source)
        self.assertIn('@supabase/supabase-js@2.118.0/', self.source)
        self.assertRegex(self.source, r'<main\s+id="main"\s*></main>')
        self.assertRegex(self.source, r'<div\s+class="stats"\s+id="stats"\s*></div>')

    def test_only_the_expected_publishable_project_key_is_present(self):
        self.assertIn('https://jvmvzfshgcekwocffdtv.supabase.co', self.source)
        self.assertIn('sb_publishable_vhNt3ZJkdWyyITrVwx3x4Q_leYix_Gq', self.source)
        self.assertNotIn('sb_' + 'secret_', self.source)
        for token in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', self.source):
            try:
                payload = token.split('.')[1]
                claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
            except (ValueError, UnicodeDecodeError):
                continue
            self.assertNotEqual(claims.get('role'), 'service_' + 'role')

    def test_crm_is_static_and_excluded_from_indexing(self):
        for config in self.configs:
            self.assertFalse(any(rule['source'].rstrip('/') == '/crm' for rule in config['redirects']))
            rewrites = config['rewrites']
            self.assertEqual(rewrites[-1], {'source': '/(.*)', 'destination': '/index.html'})
            for source in ('/crm', '/crm/'):
                self.assertIn({'source': source, 'destination': '/crm.html'}, rewrites[:-1])
            for source in ('/crm', '/crm/', '/crm.html'):
                rule = next(rule for rule in config['headers'] if rule['source'] == source)
                headers = {header['key'].lower(): header['value'].lower() for header in rule['headers']}
                self.assertIn('noindex', headers['x-robots-tag'])
                self.assertIn('no-store', headers['cache-control'])
        self.assertRegex((ROOT / 'frontend/public/robots.txt').read_text(), r'(?m)^Disallow:\s*/crm\s*$')
        sitemap = ET.parse(ROOT / 'frontend/public/sitemap.xml')
        locations = [node.text or '' for node in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertFalse(any('/crm' in location.lower() for location in locations))

    def test_crm_not_added_to_react_navigation_and_script_parses(self):
        for file in (ROOT / 'frontend/src').rglob('*'):
            if file.is_file() and file.suffix in ('.js', '.jsx', '.ts', '.tsx'):
                self.assertNotRegex(file.read_text(encoding='utf-8'), r'["\']/crm(?:/|["\'])')
        script = re.search(r'<script>\s*([\s\S]*?)</script>', self.source)
        self.assertIsNotNone(script)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', encoding='utf-8') as temp:
            temp.write(script.group(1))
            temp.flush()
            subprocess.run(['node', '--check', temp.name], check=True, capture_output=True, text=True)

    def test_sync_uses_realtime_and_saves_pending_changes(self):
        self.assertIn('postgres_changes', self.source)
        self.assertIn('table:"records"', self.source)
        self.assertIn('mib_pending_v1', self.source)
        self.assertIn('Some changes have not synced', self.source)
        self.assertIn('Replace ALL current data with this backup?', self.source)

    def test_photo_controls_require_private_storage_and_do_not_use_public_urls(self):
        self.assertIn('mib_crm_photo_storage_private_v1', self.source)
        self.assertIn('bucket.download(path,{}, {cache:"no-store"})', self.source)
        self.assertNotIn('getPublicUrl', self.source)
        self.assertIn('Photo files are not included', self.source)
        self.assertIn('not automatically deleted from storage', self.source)
        sql = (ROOT / 'supabase/crm_job_photos.sql').read_text(encoding='utf-8')
        self.assertIn('SECURITY INVOKER', sql)
        self.assertIn('AS RESTRICTIVE', sql)
        self.assertIn('GRANT EXECUTE ON FUNCTION public.mib_crm_photo_storage_private_v1() TO authenticated', sql)


if __name__ == '__main__':
    unittest.main()

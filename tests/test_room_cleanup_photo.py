"""Checks for the user-supplied room comparison and its crawlable pages."""

from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'frontend'
POST = json.loads((FRONTEND / 'src/data/roomCleanupPost.json').read_text())
HUB = json.loads((FRONTEND / 'src/data/makeReadyContent.json').read_text())
ORIGIN = 'https://www.maintainitbandits.com'


class Snapshot(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta, self.canonical, self.schemas, self.links, self.images = {}, [], [], [], []
        self.text, self.title, self.schema = [], '', None
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            self.meta.setdefault(attrs.get('name') or attrs.get('property'), []).append(attrs.get('content'))
        elif tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical.append(attrs.get('href'))
        elif tag == 'a':
            self.links.append(attrs.get('href'))
        elif tag == 'img':
            self.images.append(attrs)
        elif tag == 'title':
            self.in_title = True
        elif tag == 'script' and attrs.get('type') == 'application/ld+json':
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
        elif tag == 'script' and self.schema is not None:
            self.schemas.append(json.loads(self.schema))
            self.schema = None


def jpeg_headers(data):
    """Read JPEG frame dimensions and ancillary markers without extra libraries."""
    if data[:2] != b'\xff\xd8':
        raise ValueError('Not a JPEG')
    pos, frame, markers = 2, None, []
    while pos < len(data):
        if data[pos] != 0xff:
            raise ValueError('Malformed JPEG header')
        while data[pos] == 0xff:
            pos += 1
        marker = data[pos]
        pos += 1
        if marker in (0xd9, 0xda):
            break
        size = int.from_bytes(data[pos:pos + 2], 'big')
        payload = data[pos + 2:pos + size]
        markers.append(marker)
        if marker in (0xc0, 0xc1, 0xc2):
            frame = (int.from_bytes(payload[3:5], 'big'), int.from_bytes(payload[1:3], 'big'))
        pos += size
    return frame, markers


def plain(value):
    return re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', value).replace('**', '')


class RoomCleanupPhotoTests(unittest.TestCase):
    def make_snapshot(self, script, env_name, output):
        with tempfile.TemporaryDirectory() as temp:
            shutil.copyfile(FRONTEND / 'public/index.html', Path(temp) / 'index.html')
            subprocess.run(['node', str(FRONTEND / 'scripts' / script)],
                           env={**os.environ, env_name: temp}, check=True, capture_output=True, text=True)
            parser = Snapshot()
            parser.feed((Path(temp) / '_prerendered' / output).read_text(encoding='utf-8'))
            return parser

    def test_photo_is_complete_optimized_and_without_private_jpeg_metadata(self):
        path = FRONTEND / 'public' / POST['image'].lstrip('/')
        data = path.read_bytes()
        dimensions, markers = jpeg_headers(data)
        self.assertEqual(dimensions, (1448, 1086))
        self.assertLess(len(data), 350_000)
        self.assertNotIn(0xe1, markers, 'APP1 may contain EXIF, GPS or XMP data')
        self.assertNotIn(0xed, markers, 'APP13 may contain IPTC data')
        self.assertEqual(POST['image'], HUB['meta']['image'])
        self.assertEqual(POST['imageAlt'], HUB['meta']['imageAlt'])
        self.assertIn('left', POST['imageAlt'])
        self.assertIn('right', POST['imageAlt'])
        self.assertIn('before', POST['imageCaption'].lower())
        self.assertIn('after', POST['imageCaption'].lower())

    def test_article_is_useful_and_does_not_invent_project_details(self):
        self.assertEqual(POST['imageLayout'], 'before-after')
        self.assertEqual(POST['category'], 'Make Ready & Turnovers')
        self.assertLess(len(POST['metaTitle']), 60)
        self.assertLess(len(POST['metaDescription']), 155)
        text = ' '.join(' '.join(b.get('items', [])) if 'items' in b else b.get('text', '') for b in POST['content'])
        self.assertGreater(len(text.split()), 300)
        self.assertIn('before and after', text.lower())
        self.assertIn('ask how to share', text.lower())
        self.assertIn('respond within 24 hours', text.lower())
        self.assertNotRegex(text, r'\$\s*\d|\b\d+\s*(?:hours|days) to (?:finish|complete)')
        self.assertIn('roomCleanupPost', (FRONTEND / 'src/data/blog.js').read_text())
        self.assertIn('roomCleanupPost', (FRONTEND / 'src/data/gallery.js').read_text())

    def test_routes_sitemap_and_prerender_build_command(self):
        config = json.loads((FRONTEND / 'vercel.json').read_text())
        article_path = '/blog/' + POST['slug']
        destination = '/_prerendered/' + POST['slug'] + '.html'
        rewrites = {rule['source']: rule['destination'] for rule in config['rewrites']}
        self.assertEqual(rewrites[article_path], destination)
        self.assertEqual(rewrites[article_path + '/'], destination)
        self.assertEqual(rewrites['/make-ready-turnovers'], '/_prerendered/make-ready-turnovers.html')
        self.assertEqual(rewrites['/crm'], '/crm.html')
        self.assertEqual(config['rewrites'][-1], {'source': '/(.*)', 'destination': '/index.html'})
        self.assertIn('node scripts/prerender-room-cleanup.cjs', config['buildCommand'])
        locations = [node.text for node in ET.parse(FRONTEND / 'public/sitemap.xml').findall('.//{*}loc')]
        self.assertEqual(locations.count(ORIGIN + article_path), 1)

    def test_article_snapshot_has_correct_photo_metadata_and_full_content(self):
        page = self.make_snapshot('prerender-room-cleanup.cjs', 'BLOG_BUILD_DIR', POST['slug'] + '.html')
        url, image = ORIGIN + '/blog/' + POST['slug'], ORIGIN + POST['image']
        self.assertEqual(page.title, POST['metaTitle'])
        self.assertEqual(page.canonical, [url])
        for key, value in {
            'description': POST['metaDescription'], 'og:title': POST['metaTitle'],
            'og:url': url, 'og:type': 'article', 'og:image': image,
            'og:image:alt': POST['imageAlt'], 'twitter:image': image,
        }.items():
            self.assertEqual(page.meta[key], [value], key)
        photo = next(img for img in page.images if img.get('src') == POST['image'])
        self.assertEqual(photo['alt'], POST['imageAlt'])
        self.assertEqual((photo['width'], photo['height']), ('1448', '1086'))
        self.assertNotIn('object-cover', photo.get('class', ''))
        visible = ' '.join(' '.join(page.text).split())
        self.assertIn(POST['imageCaption'], visible)
        visible_words = ' '.join(re.findall(r"[\w']+", visible))
        for block in POST['content']:
            for value in block.get('items', [block.get('text', '')]):
                self.assertIn(' '.join(re.findall(r"[\w']+", plain(value))), visible_words)
        self.assertIn('/contact?service=make-ready-services', page.links)
        self.assertIn('/make-ready-turnovers', page.links)
        article = next(s for s in page.schemas if s.get('@type') == 'BlogPosting')
        self.assertEqual(article['headline'], POST['title'])
        self.assertEqual(article['image'], image)
        self.assertEqual(article['datePublished'], POST['date'])
        self.assertEqual(sum(s.get('@type') == 'BreadcrumbList' for s in page.schemas), 1)

    def test_hub_snapshot_exposes_the_photo_and_guide(self):
        page = self.make_snapshot('prerender-make-ready.cjs', 'MAKE_READY_BUILD_DIR', 'make-ready-turnovers.html')
        photo = next(img for img in page.images if img.get('src') == POST['image'])
        self.assertEqual(photo['alt'], POST['imageAlt'])
        self.assertEqual((photo['width'], photo['height']), ('1448', '1086'))
        self.assertNotIn('object-cover', photo.get('class', ''))
        self.assertEqual(page.meta['og:image'], [ORIGIN + POST['image']])
        self.assertIn('/blog/' + POST['slug'], page.links)
        self.assertIn('/gallery', page.links)
        visible = ' '.join(' '.join(page.text).split())
        for value in HUB['spotlight'].values():
            self.assertIn(value, visible)
        self.assertIn(POST['imageCaption'], visible)


if __name__ == '__main__':
    unittest.main()

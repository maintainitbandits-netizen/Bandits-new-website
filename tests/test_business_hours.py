"""Keep visible business hours and search-engine data in sync."""

import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path


FRONTEND = Path(__file__).resolve().parents[1] / 'frontend'
EXPECTED = {
    'Monday': ('07:00', '17:00'),
    'Tuesday': ('07:00', '17:00'),
    'Wednesday': ('07:00', '17:00'),
    'Thursday': ('07:00', '17:00'),
    'Friday': ('07:00', '17:00'),
    'Saturday': ('09:00', '17:00'),
    'Sunday': ('09:00', '17:00'),
}


class SchemaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.schemas = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag == 'script' and dict(attrs).get('type') == 'application/ld+json':
            self.current = []

    def handle_data(self, data):
        if self.current is not None:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self.current is not None:
            self.schemas.append(json.loads(''.join(self.current)))
            self.current = None


def business_hours(html):
    parser = SchemaParser()
    parser.feed(html)
    business = next(s for s in parser.schemas if s.get('@id') == 'https://www.maintainitbandits.com/#business')
    return {h['dayOfWeek']: (h['opens'], h['closes']) for h in business['openingHoursSpecification']}


class BusinessHoursTests(unittest.TestCase):
    def test_visible_hours_and_dynamic_schedule_match_confirmed_hours(self):
        source = (FRONTEND / 'src/mock.js').read_text()
        display = re.search(r"^\s*hours:\s*'([^']+)'", source, re.MULTILINE)
        self.assertIsNotNone(display)
        self.assertEqual(json.loads('"' + display.group(1) + '"'),
                         'Mon–Fri: 7:00 AM – 5:00 PM · Sat–Sun: 9:00 AM – 5:00 PM')
        schedule = re.search(r'hoursStructured:\s*\[(.*?)\]', source, re.DOTALL)
        self.assertIsNotNone(schedule)
        entries = re.findall(r"day:\s*'(\w+)',\s*open:\s*'([^']+)',\s*close:\s*'([^']+)'", schedule.group(1))
        self.assertEqual(len(entries), len(EXPECTED))
        self.assertEqual({day: (opens, closes) for day, opens, closes in entries}, EXPECTED)
        for name in ('components/Footer.jsx', 'pages/Contact.jsx', 'pages/ServiceAreaDetail.jsx'):
            self.assertIn('COMPANY.hours', (FRONTEND / 'src' / name).read_text(), name)
        self.assertIn('COMPANY.hoursStructured', (FRONTEND / 'src/pages/Home.jsx').read_text())

    def test_static_business_schema_matches_confirmed_hours(self):
        self.assertEqual(business_hours((FRONTEND / 'public/index.html').read_text()), EXPECTED)

    def test_prerendered_pages_keep_the_static_sunday_hours(self):
        with tempfile.TemporaryDirectory() as temp:
            shutil.copyfile(FRONTEND / 'public/index.html', Path(temp) / 'index.html')
            jobs = (
                ('prerender-fall-cleanup.cjs', 'BLOG_BUILD_DIR', 'fall-cleanup-austin-rental-properties.html'),
                ('prerender-make-ready.cjs', 'MAKE_READY_BUILD_DIR', 'make-ready-turnovers.html'),
            )
            for script, env_name, output in jobs:
                with self.subTest(script=script):
                    subprocess.run(['node', str(FRONTEND / 'scripts' / script)],
                                   env={**os.environ, env_name: temp}, check=True,
                                   capture_output=True, text=True)
                    html = (Path(temp) / '_prerendered' / output).read_text()
                    self.assertEqual(business_hours(html), EXPECTED)


if __name__ == '__main__':
    unittest.main()

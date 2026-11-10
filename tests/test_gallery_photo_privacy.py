"""Regression checks for the reviewed, locally redacted website photos.

The image hashes pin the visually inspected privacy edits. If one of these images
is replaced or recompressed, recheck the address regions visually and update the
hashes only after confirming that no numbers are readable. This does not inspect
newly added photos or images hosted by third parties.
"""

import hashlib
from pathlib import Path
import re
import unittest

from tests.test_room_cleanup_photo import jpeg_headers

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'frontend'
GALLERY = FRONTEND / 'public' / 'gallery'


class GalleryPhotoPrivacyTests(unittest.TestCase):
    def assert_reviewed_jpeg(self, filename, expected_hash, dimensions):
        data = (GALLERY / filename).read_bytes()
        self.assertEqual(hashlib.sha256(data).hexdigest(), expected_hash,
                         f'{filename} changed: visually recheck the privacy blur before updating this hash')
        frame, markers = jpeg_headers(data)
        self.assertEqual(frame, dimensions)
        self.assertLess(len(data), 1_000_000)
        self.assertNotIn(0xe1, markers, 'APP1 may contain EXIF, GPS, XMP or an embedded thumbnail')
        self.assertNotIn(0xed, markers, 'APP13 may contain IPTC data')
        return data

    def test_all_copies_of_the_mulch_photo_use_the_reviewed_blur(self):
        digest = 'b43e077955b4fb2fcde60fc5826a797fb7a720787cb6bfdb7bfa3d7c5b37e5d6'
        after = self.assert_reviewed_jpeg('mulch-after.jpg', digest, (1400, 1859))
        service = self.assert_reviewed_jpeg('service-mulching.jpg', digest, (1400, 1859))
        self.assertEqual(after, service, 'The service image must not retain an unredacted duplicate')

    def test_make_ready_hero_uses_the_reviewed_blur(self):
        self.assert_reviewed_jpeg('make-ready-hero.jpg',
                                  '21b00a0549638feb6bfb2e1ff9a8cfc7028cb325741147fa0facd12b87571bca',
                                  (1408, 768))

    def test_public_references_bust_previous_browser_image_caches(self):
        expected = {
            'src/data/gallery.js': '/gallery/mulch-after.jpg?v=privacy-1',
            'src/mock.js': '/gallery/service-mulching.jpg?v=privacy-1',
            'src/pages/Home.jsx': '/gallery/make-ready-hero.jpg?v=privacy-1',
            'src/data/blog.js': '/gallery/make-ready-hero.jpg?v=privacy-1',
        }
        for name, url in expected.items():
            with self.subTest(name=name):
                self.assertIn(url, (FRONTEND / name).read_text(encoding='utf-8'))

        unversioned = re.compile(r'/gallery/(?:mulch-after|service-mulching|make-ready-hero)\.jpg(?!\?v=privacy-1)')
        for directory in (FRONTEND / 'src', FRONTEND / 'scripts'):
            for path in directory.rglob('*'):
                if path.suffix not in ('.js', '.jsx', '.cjs', '.json'):
                    continue
                with self.subTest(path=path.relative_to(FRONTEND)):
                    self.assertNotRegex(path.read_text(encoding='utf-8'), unversioned)


if __name__ == '__main__':
    unittest.main()

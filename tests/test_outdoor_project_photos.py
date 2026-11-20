"""Regression tests for owner-supplied outdoor project photos.

The hashes pin the privacy-reviewed JPEGs. Recheck the rock photo's redacted
area and all metadata before changing a hash. Tests cannot audit new photos or
third-party-hosted media for house numbers automatically.
"""

import hashlib
from pathlib import Path
import re
import unittest

from tests.test_room_cleanup_photo import jpeg_headers

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / 'frontend'
SRC = FRONTEND / 'src'
PUBLIC = FRONTEND / 'public'


def data_block(text, field, value):
    match = re.search(r"  \{\n\s+" + re.escape(field) + r": " + re.escape(value) + r",[\s\S]*?\n  \},", text)
    if not match:
        raise AssertionError(f'No data block found for {field}: {value}')
    return match.group()


class OutdoorProjectPhotoTests(unittest.TestCase):
    def test_reviewed_files_are_complete_optimized_and_metadata_free(self):
        photos = {
            'sod-install-before.jpg': ((1320, 859), '495ec742738fe2bf75d99704ba0e58c2413a3425dc0bc3c200351f89e572a92e'),
            'sod-install-after.jpg': ((1320, 861), 'ad2922014a2315e79152c3f4b36b3f90b562616f772ae29081c923dc4432ab96'),
            'decorative-rock-bed.jpg': ((1320, 709), '9b0ace6ac5e3deccba6a3b17483f0592a7a6e50c549cbde5269b955bc921d526'),
            'flower-bed-planting.jpg': ((1320, 857), 'ee6c6248703543aed2e853a9a73abef846e83c49662c3afb3f4199648d81c2fd'),
        }
        for filename, (expected_size, expected_hash) in photos.items():
            with self.subTest(filename=filename):
                data = (PUBLIC / 'gallery' / filename).read_bytes()
                size, markers = jpeg_headers(data)
                self.assertEqual(size, expected_size)
                self.assertLess(len(data), 600_000)
                self.assertEqual(hashlib.sha256(data).hexdigest(), expected_hash,
                                 'If the file changes, inspect it for privacy before updating the hash')
                for marker in (0xe1, 0xed, 0xfe):
                    self.assertNotIn(marker, markers, 'EXIF, XMP, IPTC and JPEG comments must not be published')

    def test_gallery_uses_real_images_without_unconfirmed_project_details(self):
        gallery = (SRC / 'data/gallery.js').read_text(encoding='utf-8')
        sod = data_block(gallery, 'id', '213')
        rock = data_block(gallery, 'id', '214')
        flower = data_block(gallery, 'id', '215')
        self.assertIn("category: 'Sod Installation'", sod)
        self.assertIn("tags: ['Landscaping']", sod)
        self.assertIn("before: '/gallery/sod-install-before.jpg'", sod)
        self.assertIn("after: '/gallery/sod-install-after.jpg'", sod)
        self.assertIn("imageFit: 'contain'", sod)
        for block, photo in ((rock, 'decorative-rock-bed.jpg'), (flower, 'flower-bed-planting.jpg')):
            self.assertIn("category: 'Landscaping'", block)
            self.assertIn(f"image: '/gallery/{photo}'", block)
            self.assertIn('fullFrame: true', block)
            self.assertIn("badge: 'Project Photo'", block)
        for block in (sod, rock, flower):
            self.assertNotIn('location:', block)
            self.assertNotRegex(block, r'\b(?:Austin|Bermuda|Zoysia|TX|St\. Augustine)\b')
            self.assertNotRegex(block, r'\b\d+\s*(?:day|hour|week)s?\b')

    def test_matching_services_and_related_content_use_the_new_photos(self):
        mock = (SRC / 'mock.js').read_text(encoding='utf-8')
        for slug, photo in (
            ('sod-installation', 'sod-install-after.jpg'),
            ('mulch-rock-installation', 'decorative-rock-bed.jpg'),
            ('flower-bed-planting', 'flower-bed-planting.jpg'),
        ):
            block = data_block(mock, 'slug', repr(slug))
            self.assertIn(f"image: '/gallery/{photo}'", block)
            self.assertIn('imageAlt:', block)
        bundles = (SRC / 'data/bundles.js').read_text(encoding='utf-8')
        for slug, photo in (('complete-yard', 'flower-bed-planting.jpg'), ('full-yard-makeover', 'sod-install-after.jpg')):
            block = data_block(bundles, 'slug', repr(slug))
            self.assertIn(f"image: '/gallery/{photo}'", block)
            self.assertIn('imageAlt:', block)
        blog = (SRC / 'data/blog.js').read_text(encoding='utf-8')
        for slug, photo in (('how-much-does-lawn-care-cost-austin-tx', 'sod-install-after.jpg'),
                            ('mulching-guide-austin-texas-when-how-much', 'flower-bed-planting.jpg')):
            article = data_block(blog, 'slug', repr(slug))
            self.assertIn(f"image: '/gallery/{photo}'", article)
            self.assertIn('imageAlt:', article)
        detail = (SRC / 'pages/ServiceDetail.jsx').read_text(encoding='utf-8')
        self.assertIn("slug === 'sod-installation'", detail)
        self.assertIn('<BeforeAfterSlider', detail)
        self.assertIn('imageAlt={svc.imageAlt}', detail)
        self.assertIn('svc.imageAlt ||', (SRC / 'pages/ServiceCityDetail.jsx').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()

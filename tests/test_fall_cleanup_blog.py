"""Checks for the locally prepared fall-cleanup blog post."""

import html
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
POST_FILE = ROOT / "frontend/src/data/fallCleanupPost.json"
DRAFT_FILE = ROOT / "drafts/fall-cleanup-austin-rental-properties.jsx"
BLOG_DATA_FILE = ROOT / "frontend/src/data/blog.js"
SITEMAP_FILE = ROOT / "frontend/public/sitemap.xml"
ORIGIN = "https://www.maintainitbandits.com"


def plain_text(value):
    """Count link labels, not link destinations or inline-markdown markers."""
    return re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", value).replace("**", "")


def words(value):
    return re.findall(r"\b[\w]+(?:[-'][\w]+)*\b", value)


class SnapshotParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.metas = {}
        self.canonicals = []
        self.schemas = []
        self.title = ""
        self.article_text = []
        self.article_links = []
        self.list_items = 0
        self.in_title = False
        self.in_article = False
        self.schema_text = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            key = attrs.get("name") or attrs.get("property")
            self.metas.setdefault(key, []).append(attrs.get("content"))
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href"))
        if tag == "title":
            self.in_title = True
        if tag == "article":
            self.in_article = True
        if self.in_article and tag == "a":
            self.article_links.append(attrs.get("href"))
        if self.in_article and tag == "li":
            self.list_items += 1
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.schema_text = ""

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_article:
            self.article_text.append(data)
        if self.schema_text is not None:
            self.schema_text += data

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "article":
            self.in_article = False
        if tag == "script" and self.schema_text is not None:
            self.schemas.append(json.loads(self.schema_text))
            self.schema_text = None


class FallCleanupBlogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.post = json.loads(POST_FILE.read_text(encoding="utf-8"))
        cls.content = cls.post["content"]
        cls.text = " ".join(
            " ".join(block.get("items", [])) if "items" in block else block.get("text", "")
            for block in cls.content
        )

    def test_article_length_and_calls_to_action(self):
        text = plain_text(self.text)
        self.assertGreaterEqual(len(words(text)), 1200)
        self.assertLessEqual(len(words(text)), 1600)
        self.assertIn("Request a free quote", " ".join(words(text)[:100]))
        self.assertEqual(self.text.count("](/contact)"), 3)
        self.assertEqual(self.text.count("](tel:+15125181558)"), 2)
        self.assertEqual(sum(block["type"] == "callout" for block in self.content), 1)

    def test_website_content_matches_jsx_draft(self):
        draft = DRAFT_FILE.read_text(encoding="utf-8").split("  return (", 1)[1]
        draft_links = re.findall(r'href="([^"]+)"', draft)
        website_links = re.findall(r"\]\(([^)]+)\)", self.text)
        self.assertEqual(draft_links, website_links)
        draft_text = re.sub(r"\{[^{}]*\}", " ", draft)
        draft_text = re.sub(r"<[^>]+>", " ", draft_text)
        self.assertEqual(words(html.unescape(draft_text)), words(plain_text(self.text)))

    def test_confirmed_details_and_conditional_timing(self):
        self.assertIn("fully licensed and insured", self.text)
        self.assertIn("within 24 hours", self.text)
        self.assertNotRegex(self.text, r"(?i)\b(?:INSERT|billing)\b")
        turnaround = next(block["text"] for block in self.content if "72-hour target" in block.get("text", ""))
        for condition in ("scope", "access", "weather", "availability"):
            self.assertIn(condition, turnaround)
        self.assertIn("rather than assuming a turnaround is guaranteed", turnaround)
        draft = DRAFT_FILE.read_text(encoding="utf-8")
        self.assertIn("fully licensed and insured", draft)
        self.assertIn("within 24 hours", draft)
        self.assertNotRegex(draft, r"(?i)\b(?:INSERT|billing)\b")

    def test_headings_checklist_faqs_and_sources(self):
        ordered_lists = [block for block in self.content if block["type"] == "orderedList"]
        self.assertEqual(len(ordered_lists), 1)
        self.assertEqual(len(ordered_lists[0]["items"]), 7)
        faq_start = next(i for i, block in enumerate(self.content) if block.get("text") == "Fall Cleanup Questions Property Managers Ask")
        faq_end = next(i for i in range(faq_start + 1, len(self.content)) if self.content[i]["type"] == "h2")
        faqs = [block for block in self.content[faq_start:faq_end] if block["type"] == "h3"]
        self.assertGreaterEqual(len(faqs), 4)
        self.assertLessEqual(len(faqs), 6)
        for destination in (
            "/services/make-ready-services",
            "/services/tenant-turnover-services",
            "https://agrilifeextension.tamu.edu/",
            "https://bexar-tx.tamu.edu/",
            "https://www.austintexas.gov/water/austin-water-cold-weather-tips",
        ):
            self.assertIn(destination, self.text)

    def test_metadata_image_and_sitemap(self):
        self.assertLess(len(self.post["metaTitle"]), 60)
        self.assertLess(len(self.post["metaDescription"]), 155)
        keywords = [keyword.strip() for keyword in self.post["keywords"].split(",")]
        self.assertEqual(keywords[0], "fall cleanup services Austin TX")
        self.assertGreaterEqual(len(keywords), 4)
        self.assertLessEqual(len(keywords), 6)
        self.assertTrue(self.post["imageAlt"])
        self.assertTrue((ROOT / "frontend/public" / self.post["image"].lstrip("/")).is_file())
        blog_source = BLOG_DATA_FILE.read_text(encoding="utf-8")
        self.assertIn("import fallCleanupPost from './fallCleanupPost.json'", blog_source)
        self.assertIn("  fallCleanupPost,", blog_source)
        root = ET.parse(SITEMAP_FILE).getroot()
        locations = [node.text for node in root.findall("{*}url/{*}loc")]
        self.assertEqual(locations.count(f"{ORIGIN}/blog/{self.post['slug']}"), 1)

    def test_crawlable_snapshot_and_frontend_routing(self):
        config = json.loads((ROOT / "frontend/vercel.json").read_text(encoding="utf-8"))
        self.assertIn("node scripts/prerender-fall-cleanup.cjs", config["buildCommand"])
        article_path = f"/blog/{self.post['slug']}"
        destination = f"/_prerendered/{self.post['slug']}.html"
        rewrites = {rule["source"]: rule["destination"] for rule in config["rewrites"]}
        self.assertEqual(rewrites[article_path], destination)
        self.assertEqual(rewrites[article_path + "/"], destination)
        self.assertEqual(config["rewrites"][-1]["destination"], "/index.html")

        with tempfile.TemporaryDirectory() as temp:
            shutil.copyfile(ROOT / "frontend/public/index.html", Path(temp) / "index.html")
            env = {**os.environ, "BLOG_BUILD_DIR": temp}
            subprocess.run(
                ["node", str(ROOT / "frontend/scripts/prerender-fall-cleanup.cjs")],
                env=env, check=True, capture_output=True, text=True,
            )
            snapshot_path = Path(temp) / destination.lstrip("/")
            parser = SnapshotParser()
            parser.feed(snapshot_path.read_text(encoding="utf-8"))

        absolute_image = ORIGIN + self.post["image"]
        self.assertEqual(parser.title, self.post["metaTitle"])
        self.assertEqual(parser.metas["description"], [self.post["metaDescription"]])
        self.assertEqual(parser.metas["og:type"], ["article"])
        self.assertEqual(parser.metas["og:title"], [self.post["metaTitle"]])
        self.assertEqual(parser.metas["og:image"], [absolute_image])
        self.assertEqual(parser.metas["og:image:alt"], [self.post["imageAlt"]])
        self.assertEqual(parser.metas["twitter:image"], [absolute_image])
        self.assertEqual(parser.canonicals, [ORIGIN + article_path])
        self.assertEqual(parser.list_items, 7)
        self.assertEqual(parser.article_links.count("/contact"), 3)
        schema = next(schema for schema in parser.schemas if schema.get("@type") == "BlogPosting")
        self.assertEqual(schema["headline"], self.post["title"])
        self.assertEqual(schema["image"], absolute_image)
        self.assertEqual(schema["datePublished"], self.post["date"])
        visible_words = " ".join(words(" ".join(parser.article_text)))
        for block in self.content:
            values = block.get("items", [block.get("text", "")])
            for value in values:
                self.assertIn(" ".join(words(plain_text(value))), visible_words)


if __name__ == "__main__":
    unittest.main()

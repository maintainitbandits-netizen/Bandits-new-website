#!/usr/bin/env python3
"""Generate the public HTML and PDF calendar from one reviewed JSON file.

ReportLab is needed only when regenerating the committed assets, not at runtime.
Example: python -m pip install reportlab==4.4.4 && python scripts/generate-lawn-calendar.py
"""

from html import escape
from pathlib import Path
import json

import reportlab.rl_config
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


FRONTEND = Path(__file__).resolve().parents[1]
DATA = FRONTEND / 'src/data/lawnCalendar.json'
DESTINATION = FRONTEND / 'public/guides'
PDF = DESTINATION / 'austin-lawn-care-calendar.pdf'
HTML = DESTINATION / 'austin-lawn-care-calendar.html'
CANONICAL = 'https://www.maintainitbandits.com/guides/austin-lawn-care-calendar.html'


def html_page(data):
    seasons = []
    for season in data['seasons']:
        months = []
        for month in season['months']:
            tasks = ''.join(f'<li>{escape(task)}</li>' for task in month['tasks'])
            months.append(
                f'<article class="month"><h3>{escape(month["name"])}</h3>'
                f'<p class="focus">{escape(month["focus"])}</p><ul>{tasks}</ul></article>'
            )
        seasons.append(
            f'<section class="season"><h2>{escape(season["title"])}</h2>'
            f'<div class="month-grid">{"".join(months)}</div></section>'
        )
    tips = ''.join(f'<li>{escape(tip)}</li>' for tip in data['quickTips'])
    sources = ''.join(
        f'<li><a href="{escape(source["url"], quote=True)}">{escape(source["label"])}</a></li>'
        for source in data['sources']
    )
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="A free 12-month Central Texas lawn care calendar with mowing, watering and seasonal planning tips.">
  <link rel="canonical" href="{CANONICAL}">
  <title>Austin Lawn Care Calendar | Maintain It Bandits</title>
  <style>
    :root {{ color-scheme: dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #080d0a; color: #eef5ef; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; line-height: 1.6; }}
    a {{ color: #9be6ab; text-underline-offset: .18em; }}
    a:focus-visible {{ outline: 3px solid #a9f8bd; outline-offset: 4px; }}
    .skip {{ position: absolute; left: -10000px; top: 1rem; background: white; color: #082514; padding: .7rem; }}
    .skip:focus {{ left: 1rem; z-index: 10; }}
    header {{ border-bottom: 1px solid #28422f; background: #0c1910; }}
    .wrap {{ max-width: 72rem; margin: auto; padding: 0 1.25rem; }}
    header .wrap {{ padding-top: 1.2rem; padding-bottom: 1.2rem; }}
    .brand {{ color: #fff; text-decoration: none; font-weight: 750; letter-spacing: .01em; }}
    .brand span {{ color: #b8d2be; font-weight: 400; }}
    main {{ padding-top: 3.6rem; padding-bottom: 4rem; }}
    .eyebrow {{ color: #9be6ab; font-size: .8rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }}
    h1, h2, h3 {{ line-height: 1.15; }}
    h1 {{ font-family: Georgia, serif; font-size: clamp(2.6rem, 8vw, 4.8rem); max-width: 15ch; margin: .7rem 0 1rem; }}
    h2 {{ font-family: Georgia, serif; font-size: clamp(1.8rem, 5vw, 2.5rem); margin: 0 0 1.2rem; }}
    h3 {{ font-size: 1.2rem; margin: 0; }}
    .lead {{ max-width: 49rem; color: #d0dfd3; font-size: 1.1rem; }}
    .actions {{ display: flex; flex-wrap: wrap; gap: .8rem; margin: 1.6rem 0 2.5rem; }}
    .button {{ background: #80da96; color: #07180c; border-radius: 999px; padding: .8rem 1.2rem; font-weight: 750; text-decoration: none; }}
    .button.secondary {{ background: transparent; border: 1px solid #5c8466; color: #dcf3e0; }}
    .notice, .tips {{ border: 1px solid #315039; border-radius: 1rem; padding: 1.2rem 1.4rem; background: #102117; }}
    .notice {{ max-width: 60rem; }}
    .notice strong {{ display: block; color: #adf0ba; margin-bottom: .3rem; }}
    .tips {{ margin: 1rem 0 3rem; }}
    .tips h2 {{ font-family: inherit; font-size: 1.1rem; margin: 0; }}
    ul {{ padding-left: 1.3rem; }}
    li + li {{ margin-top: .65rem; }}
    .season {{ margin: 3rem 0; }}
    .month-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 1rem; }}
    .month {{ border: 1px solid #283b2e; border-radius: 1rem; background: #101a13; padding: 1.4rem; }}
    .focus {{ color: #9be6ab; margin: .25rem 0 .8rem; font-weight: 650; }}
    .month ul {{ color: #d8e4da; margin-bottom: 0; }}
    .sources {{ border-top: 1px solid #28422f; padding-top: 2rem; }}
    .sources li {{ overflow-wrap: anywhere; }}
    .contact {{ margin-top: 3rem; border-radius: 1rem; background: #15341f; padding: 1.5rem; }}
    .contact h2 {{ margin-bottom: .4rem; }}
    footer {{ border-top: 1px solid #28422f; color: #b8cbbd; padding: 1.5rem 0; }}
    @media print {{ :root {{ color-scheme: light; background: #fff; color: #111; }} header, .actions, .contact, footer, .skip {{ display: none; }} main {{ padding: 0; }} .month-grid {{ display: block; }} .month, .notice, .tips {{ color: #111; background: #fff; border-color: #777; margin-bottom: .7rem; break-inside: avoid; }} .month ul, .lead {{ color: #111; }} .focus, .eyebrow, a {{ color: #174d29; }} }}
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to calendar</a>
  <header><div class="wrap"><a class="brand" href="/">Maintain It Bandits <span>· Austin, TX</span></a></div></header>
  <main id="main" class="wrap">
    <p class="eyebrow">Free local guide · No email required</p>
    <h1>{escape(data['title'])}</h1>
    <p class="lead">{escape(data['intro'])}</p>
    <div class="actions"><a class="button" href="/guides/austin-lawn-care-calendar.pdf" download>Download the printable PDF</a><a class="button secondary" href="/">Back to the website</a></div>
    <aside class="notice"><strong>Before you start</strong>{escape(data['notice'])}</aside>
    <section class="tips"><h2>Good habits all year</h2><ul>{tips}</ul></section>
    {''.join(seasons)}
    <section class="sources"><h2>Resources and current guidance</h2><p>Check your own water provider for the rules that apply to your property.</p><ul>{sources}</ul></section>
    <section class="contact"><h2>Need a hand with your property?</h2><p>Tell us what work you have in mind and request an estimate.</p><a href="/contact">Contact Maintain It Bandits</a></section>
  </main>
  <footer><div class="wrap">Maintain It Bandits LLC · Serving greater Austin</div></footer>
</body>
</html>
'''


def pdf_document(data):
    # Stable output makes regeneration and review straightforward.
    reportlab.rl_config.invariant = 1
    dark = colors.HexColor('#163321')
    green = colors.HexColor('#397a48')
    muted = colors.HexColor('#425a48')
    light = colors.HexColor('#eef6ef')
    styles = {
        'title': ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=25, leading=29, textColor=dark, spaceAfter=3),
        'subtitle': ParagraphStyle('subtitle', fontName='Helvetica', fontSize=11, leading=15, textColor=muted, spaceAfter=8),
        'season': ParagraphStyle('season', fontName='Helvetica-Bold', fontSize=15, leading=18, textColor=dark, spaceBefore=3, spaceAfter=8),
        'body': ParagraphStyle('body', fontName='Helvetica', fontSize=10, leading=14, textColor=dark, spaceAfter=4),
        'notice': ParagraphStyle('notice', fontName='Helvetica', fontSize=9.5, leading=13, textColor=dark),
        'month': ParagraphStyle('month', fontName='Helvetica-Bold', fontSize=11.5, leading=15, textColor=green, spaceAfter=4),
        'task': ParagraphStyle('task', fontName='Helvetica', fontSize=10, leading=13.5, leftIndent=11, firstLineIndent=-8, textColor=dark, spaceAfter=3),
        'source': ParagraphStyle('source', fontName='Helvetica', fontSize=9, leading=12, leftIndent=9, firstLineIndent=-7, textColor=dark, spaceAfter=2),
    }

    def p(text, style):
        return Paragraph(escape(text), styles[style])

    def card(month):
        content = [p(f'{month["name"].upper()}  |  {month["focus"]}', 'month')]
        content.extend(Paragraph('&#8226; ' + escape(task), styles['task']) for task in month['tasks'])
        table = Table([[content]], colWidths=[7.25 * inch], hAlign='LEFT')
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), light),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#c7dec9')),
            ('LEFTPADDING', (0, 0), (-1, -1), 11),
            ('RIGHTPADDING', (0, 0), (-1, -1), 11),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ]))
        return KeepTogether([table, Spacer(1, 7)])

    def page_chrome(canvas, doc):
        canvas.saveState()
        width, height = letter
        canvas.setFillColor(dark)
        canvas.rect(0, height - 28, width, 28, stroke=0, fill=1)
        canvas.setFont('Helvetica-Bold', 8)
        canvas.setFillColor(colors.white)
        canvas.drawString(42, height - 18, 'MAINTAIN IT BANDITS  /  CENTRAL TEXAS')
        canvas.setStrokeColor(colors.HexColor('#c7dec9'))
        canvas.line(42, 36, width - 42, 36)
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(muted)
        canvas.drawString(42, 23, 'maintainitbandits.com  |  General guidance; check current local rules')
        canvas.drawRightString(width - 42, 23, str(doc.page))
        canvas.restoreState()

    doc = SimpleDocTemplate(str(PDF), pagesize=letter, leftMargin=42, rightMargin=42, topMargin=40, bottomMargin=48,
                            title=data['title'], author='Maintain It Bandits LLC', subject=data['subtitle'])
    story = []
    for index, season in enumerate(data['seasons']):
        if index:
            story.append(PageBreak())
        if index == 0:
            story.extend([p(data['title'], 'title'), p(data['subtitle'], 'subtitle'), p(data['intro'], 'body')])
            notice = Table([[p('Before you start: ' + data['notice'], 'notice')]], colWidths=[7.25 * inch])
            notice.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f3f5e9')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#ccd7b2')),
                ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
                ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ]))
            story.extend([notice, Spacer(1, 9), p('Good habits all year', 'month')])
            story.extend(Paragraph('&#8226; ' + escape(tip), styles['task']) for tip in data['quickTips'])
            story.append(Spacer(1, 4))
        story.append(p(season['title'].capitalize(), 'season'))
        story.extend(card(month) for month in season['months'])
        if index == len(data['seasons']) - 1:
            story.append(p('Resources and current guidance', 'season'))
            for source in data['sources']:
                label = escape(source['label'])
                url = escape(source['url'], quote=True)
                story.append(Paragraph(f'&#8226; <link href="{url}" color="#285f38">{label}</link>', styles['source']))
            story.append(Spacer(1, 3))
            story.append(p('Check your own water provider for the rules that apply to your property.', 'body'))
    doc.build(story, onFirstPage=page_chrome, onLaterPages=page_chrome)


def main():
    data = json.loads(DATA.read_text(encoding='utf-8'))
    months = [month['name'] for season in data['seasons'] for month in season['months']]
    assert months == ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    assert all(source['url'].startswith('https://') for source in data['sources'])
    DESTINATION.mkdir(parents=True, exist_ok=True)
    HTML.write_text(html_page(data), encoding='utf-8')
    pdf_document(data)
    print(f'Generated {HTML.relative_to(FRONTEND)} and {PDF.relative_to(FRONTEND)}')


if __name__ == '__main__':
    main()

# Knotty Sea Fishing Charters

A redesigned, responsive charter website built with React and Vite. Deploy as a static site on Vercel—no database, server, API keys, or paid services required.

## Run locally

Use Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Production build: `npm run build`. Preview it: `npm run preview`.

## Protect the existing Bandits website

This redesign is isolated on `arena/01a0e917-bandits-new-website`. Do not merge it into the existing Bandits production branch: the root deployment configuration now serves Knotty Sea. `vercel.json` disables automatic Git deployments from this branch to avoid triggering the connected Bandits projects. This push is for code storage, not deployment.

For launch, use a separate Knotty Sea repository and a separate Vercel project. Copy the root app files (including `src/`, `public/`, `index.html`, package files, and Vite/Vercel configuration), rather than replacing the existing Bandits site. In that isolated project, remove the `git.deploymentEnabled` restriction or enable its chosen branch. Do not change the Bandits project’s production branch, domains, or DNS.

## Deploy from GitHub to Vercel

1. Put the charter app in its own GitHub repository as described above. The copy stored in the Bandits repository is for safekeeping only.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Select the charter repository’s production branch in the new, separate Vercel project. Do not merge this redesign into the Bandits production branch.
4. Set **Root Directory to the repository root (`.`)**, not `frontend`.
5. Framework: **Vite**. Install command: `npm ci`. Build command: `npm run build`. Output directory: `dist`. These are also configured in `vercel.json`.
6. No environment variables are required. Deploy, test the Vercel URL, then attach your domain in Vercel's domain settings.

**Existing repository note:** the old `frontend/` and `backend/` directories are retained but are not used by this redesign. The new root Vite project and root Vercel configuration replace the prior deployment entry point. Deploy this as a separate Vercel project if you need to keep the old Bandits website online.

## What's included

- Responsive desktop/mobile navigation, local hero image and self-hosted fonts.
- Four private charter packages; rates labeled per boat, with captain confirmation.
- Captain/boat introduction, trip inclusions, techniques, FAQs, directions and contact details.
- Accessible native dialog with Escape handling, focus restoration, required fields and date validation.
- Trip selection and editable email request preparation.
- Page title, description, theme color and SVG favicon.
- Automated desktop/mobile browser smoke tests.

## How trip requests work (important)

The form **does not send an email automatically**. It validates the visitor's inputs and generates a `mailto:` link. The visitor must open their configured email application and send the message. The site clearly explains this and provides phone/email alternatives. No data is stored by the site, no payment is taken, and no date is reserved.

For direct delivery, live calendars, deposits or instant confirmation, integrate a vetted booking platform or a server-side form/email service. Do not put email-provider secrets in browser code.

## Before launching publicly

- Confirm ownership/permission to use the Knotty Sea name, business information and branding.
- **Replace `public/images/offshore-hero.jpg` with a licensed photo of the actual boat. The current image is AI-generated illustrative imagery, not a photograph of Salty Dog.** It is used in both the hero and About section; both alt texts identify it as illustrative.
- Add approved real photos of Captain Mike and guests/catches. No fabricated reviews or review counts are included.
- Confirm prices ($1,300 / $1,700 / $2,100 / $2,500), durations, capacity, inclusions, fishing techniques, phone, email and meeting address against current business details. They were based on the supplied website and are not independently verified.
- Have the captain approve trip descriptions and intended audiences.
- Add confirmed deposit/cancellation/weather policies; no unverified cancellation guarantee is made here.
- Send a real request using an email client and confirm the captain receives it. Confirm directions and dock instructions.
- Add applicable privacy terms before introducing analytics, cookies, direct form storage or payment processing.
- After choosing the final domain, add your canonical URL and sitemap, and configure Google Search Console/Business Profile.

## Edit the website

- Copy, trip prices, FAQs, contact information and request form: `src/main.jsx`
- Colors, responsive layouts and typography: `src/styles.css`
- Metadata/title: `index.html`
- Deployment: `vercel.json`
- Photos/icons: `public/`

## Tests

```sh
npx playwright install --with-deps chromium
npm test
npm run build
```

Tests cover package selection, form preparation, draft editing, dismissal, FAQ interaction, mobile navigation, image loading and mobile overflow. To use a preinstalled Chromium, set `CHROMIUM_PATH` to its executable. Tests never send email or place bookings.

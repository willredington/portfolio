# Portfolio — willredington.com

Professional portfolio site for Will Redington. Static [Astro](https://astro.build) build, deployed to [Vercel](https://vercel.com) at `portfolio.willredington.com`.

## Local development

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # produces dist/
npm run preview    # serve dist/ locally
```

## Project layout

```
src/
  pages/                    # index.astro, case-studies/[slug].astro
  content/case-studies/     # MDX content per case study
  components/               # Nav, Hero, About, Experience, CaseStudies, OtherWork, Contact, Footer, CaseStudyCard
  layouts/                  # BaseLayout, CaseStudyLayout
  styles/globals.css        # Tailwind + editorial prose styling
public/
  resume.pdf
  diagrams/                 # SVG architecture diagrams
```

Content model for case studies is in `src/content.config.ts` (frontmatter schema).

## Deployment

The site is a static Astro build hosted on Vercel. Vercel auto-detects the Astro
framework preset (`astro build` → `dist/`); `vercel.json` adds the security
headers and cache-control rules, plus clean URLs. Gzip/Brotli compression is
handled by Vercel automatically.

### Continuous deployment (recommended)

Once the project is linked to a Git repository in the Vercel dashboard, every
push to the default branch ships to production and every PR gets a preview
deployment — no manual step required.

### Deploying from your laptop

```bash
vercel          # deploy a preview
vercel --prod   # deploy to production
```

The first run links the local directory to the Vercel project (already done if
`.vercel/` exists locally).

### Custom domain

`portfolio.willredington.com` is attached to the Vercel project. To point DNS at
Vercel, create the record Vercel shows under **Project → Settings → Domains**
(typically a `CNAME` for `portfolio` → `cname.vercel-dns.com`). The site URL used
for sitemap generation is set via `site` in `astro.config.mjs`.

### Verifying

- `https://portfolio.willredington.com` loads the landing page
- Each case study link renders with its diagram and content
- Resume download (`/resume.pdf`) serves the PDF
- `vercel ls` / the Vercel dashboard shows the latest production deployment as Ready

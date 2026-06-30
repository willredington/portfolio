# AGENTS.md

Guidance for AI agents working in this repository.

## What this is

Personal portfolio site for Will Redington (`portfolio.willredington.com`). A
**static** [Astro 5](https://astro.build) build styled with **Tailwind CSS 3**,
deployed to **Vercel**. Dark-theme only. No client-side framework, no database,
no backend.

## Commands

```bash
npm install          # install deps (npm; package-lock.json is committed)
npm run dev          # dev server at http://localhost:4321
npm run build        # static build -> dist/
npm run preview      # serve dist/ locally
npx astro check      # TypeScript + Astro diagnostics (the typecheck step)
```

There is no test framework, linter, or formatter configured. Verify changes with
`npx astro check` and `npm run build`, plus a manual look via `npm run dev`.

Note: `.claude/settings.local.json` pre-allows `./scripts/deploy.sh`, but no
`scripts/` directory exists. Deploys go through the Vercel CLI (`vercel`,
`vercel --prod`) or Vercel Git auto-deploy — see `README.md`.

## Layout

```
src/
  config.ts                 # SITE constants (name, url, email, socials)
  content.config.ts         # case-studies collection + frontmatter schema (zod)
  pages/
    index.astro             # single landing page; composes section components
    case-studies/[slug].astro  # dynamic route over the caseStudies collection
  content/case-studies/     # one .mdx file per case study (the content source)
  components/               # Nav, Hero, About, Experience, CaseStudies,
                           # OtherWork, Contact, Footer, CaseStudyCard (.astro)
  layouts/                  # BaseLayout (head/meta/skip-link), CaseStudyLayout
  styles/globals.css        # font imports, Tailwind layers, custom utilities
public/
  resume.pdf
  diagrams/                 # SVG architecture diagrams referenced in MDX
astro.config.mjs            # site URL, integrations, output: static, _assets dir
tailwind.config.mjs         # color/font/maxWidth theme tokens
```

## Conventions

- **Components are `.astro`.** Match the existing frontmatter (`---`) +
  markup style; no React/Vue/Svelte despite the Tailwind content glob listing
  them.
- **Imports use the `@/*` alias** → `src/*` (e.g. `@/layouts/BaseLayout.astro`,
  `@/components/Nav.astro`). TypeScript is `astro/tsconfigs/strict`.
- **Tailwind base styles are disabled** (`applyBaseStyles: false`); base/element
  styling lives in `src/styles/globals.css` under `@layer base`.
- **Use the existing custom utility classes** instead of re-deriving them:
  `container-wide`, `container-prose`, `eyebrow`, `link-underline`,
  `btn-primary`, `btn-secondary`, `pill`, and the `prose-editorial` family for
  MDX content (defined in `globals.css` `@layer components`).
- **Use theme tokens, not raw hex.** Colors are the `ink` scale (`ink-950`…
  `ink-50`) and `accent` (`accent`, `accent-soft`, `accent-muted`). Fonts are
  `font-serif` (Fraunces), `font-sans` (Inter), `font-mono`. Add new tokens to
  `tailwind.config.mjs` rather than inlining values.
- **Site-wide strings** (name, email, social links) come from `src/config.ts`.

## Adding a case study

1. Create `src/content/case-studies/<slug>.mdx`. The filename is the URL slug
   (`/case-studies/<slug>`).
2. Provide frontmatter matching the schema in `src/content.config.ts`:
   required `title`, `outcome`, `summary`, `stack` (string array), `order`
   (number); optional `role`, `year`, `company`. The build fails on schema
   violations.
3. Body is MDX; it renders inside `CaseStudyLayout` with `prose-editorial`
   styling. Put any diagrams in `public/diagrams/` and reference them by
   absolute path (`/diagrams/...`).
4. `order` controls listing position on the landing page.

## Notes for changes

- Keep the site **static** (`output: "static"`) and **dependency-light** — this
  is a portfolio, not an app. Don't add runtime/server code or heavy libs
  without a clear reason.
- Hashed build assets land in `dist/_assets/` and are served with immutable
  long-cache headers via `vercel.json`; don't hand-reference asset URLs.
- `dist/` and `.astro/` are build output (gitignored). Never edit them by hand.

# Portfolio — willredington.com

Professional portfolio site for Will Redington. Static Astro build, served from an `nginx:alpine` container on a Raspberry Pi, exposed publicly via a Cloudflare tunnel at `portfolio.willredington.com`.

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

Content model for case studies is in `src/content/config.ts` (frontmatter schema).

## Deployment

### One-time Raspberry Pi setup

1. **Install Docker** on the Pi (follow [official instructions](https://docs.docker.com/engine/install/debian/)). Make sure `docker compose` is available.
2. **Cloudflare tunnel** — already running on the Pi as a systemd service (`cloudflared.service`) using a token-based remote tunnel. Add a **Public Hostname** route in the Cloudflare dashboard:
   - Hostname: `portfolio.willredington.com`
   - Service: `http://localhost:8081`

### Deploying from your laptop

```bash
./scripts/deploy.sh
```

The script `rsync`s the project source to `will@raspberrypi.local:~/portfolio/` and runs `docker compose up -d --build` on the Pi.

### Verifying

After the first deploy:

- `https://portfolio.willredington.com` loads the landing page
- Each case study link renders with its diagram and content
- Resume download (`/resume.pdf`) serves the PDF
- On the Pi: `docker compose ps` shows `portfolio` as `Up`
- Reboot the Pi and confirm the container auto-starts

### Debugging locally on the Pi

The container is exposed on `127.0.0.1:8081` so you can SSH-tunnel to it for direct access bypassing Cloudflare:

```bash
ssh -L 8081:localhost:8081 will@raspberrypi.local
# Then hit http://localhost:8081 on your laptop
```

## TODO before first deploy

- [ ] Fill in GitHub username in `src/config.ts` (`SITE.github`)
- [ ] Add Public Hostname `portfolio.willredington.com -> http://localhost:8081` in the Cloudflare dashboard (Zero Trust → Networks → Tunnels → your tunnel → Public Hostname)

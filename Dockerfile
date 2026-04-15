# syntax=docker/dockerfile:1.6

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps (leverage layer caching)
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Build
COPY . .
RUN npm run build

# ---- runtime ----
FROM nginx:1.27-alpine AS runtime

# Replace default nginx config with our static-site config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Healthcheck: just returns 200 from nginx root
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

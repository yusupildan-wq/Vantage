# ── Stage 1: build frontend ────────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# API key is fetched at runtime from /config — no build arg needed
RUN echo "VITE_API_URL=" > .env && npm run build

# ── Stage 2: build backend ─────────────────────────────────────────────────
FROM node:20-alpine AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ── Stage 3: production runtime ────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
COPY --from=backend /app/backend/dist ./backend/dist
COPY --from=backend /app/backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev
WORKDIR /app
COPY --from=frontend /app/frontend/dist ./frontend/dist
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "backend/dist/index.js"]

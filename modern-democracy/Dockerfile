FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_BASE=http://localhost:8787
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
# vite.config.ts must ship with the runtime: `vite preview` reads
# preview.allowedHosts from it, and without it non-localhost hosts are blocked.
COPY package.json vite.config.ts ./
EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]

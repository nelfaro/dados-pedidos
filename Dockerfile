FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM node:22-alpine AS proddeps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Script para crear usuarios desde la consola de Easypanel. Standalone empaqueta pg y bcryptjs
# dentro del bundle, asi que se copian los paquetes de produccion para que el script los resuelva.
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=build /app/scripts ./scripts
EXPOSE 3000
CMD ["node", "server.js"]

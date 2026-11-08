# Parcelo web app (guard desk, resident, admin, and the /welcome/ intro page). Build from the repo root:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com -t parcelo-web .
FROM node:20-slim AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/web apps/web
RUN npm ci && npm run build:web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

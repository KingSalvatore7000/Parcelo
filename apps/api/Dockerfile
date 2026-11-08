# Parcelo API. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t parcelo-api .
FROM node:20-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared packages/shared
COPY apps/api/prisma apps/api/prisma
# postinstall builds packages/shared and generates the Prisma client
RUN npm ci
COPY apps/api apps/api
RUN npm run build:api && npm prune --omit=dev && mkdir -p apps/api/node_modules

FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/apps/api/package.json apps/api/
# npm keeps some API packages (Prisma 5) beside the workspace instead of hoisting them
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
RUN mkdir -p apps/api/uploads/parcels && chown -R node:node apps/api/uploads
USER node
WORKDIR /app/apps/api
EXPOSE 4000
# Apply pending migrations with the project's own Prisma (--no-install: never download another), then start
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && node dist/index.js"]

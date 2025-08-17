FROM node:18-alpine AS base

WORKDIR /app

COPY package*.json ./

FROM base AS dependencies
RUN npm ci --only=production && npm cache clean --force

FROM base AS development
RUN npm ci && npm cache clean --force
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build

FROM node:18-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S foodprint -u 1001

WORKDIR /app

COPY --from=dependencies --chown=foodprint:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=foodprint:nodejs /app/dist ./dist
COPY --from=build --chown=foodprint:nodejs /app/package*.json ./

RUN mkdir -p logs && chown foodprint:nodejs logs

USER foodprint

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]


FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
RUN apk upgrade --no-cache && apk add --no-cache curl && addgroup -S vnshop && adduser -S -G vnshop vnshop
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
RUN chown -R vnshop:vnshop /app
USER vnshop
ENV PORT=8096
EXPOSE 8096
HEALTHCHECK --interval=30s --timeout=20s --start-period=30s --retries=3 CMD curl -f http://localhost:8096/health || exit 1
CMD ["node", "dist/main.js"]

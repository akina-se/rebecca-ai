# Stage 1: Build all workspaces and dependencies
FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Copy root configuration and dependency definitions
COPY package*.json turbo.json tsconfig*.json ./
COPY packages ./packages
COPY apps/bot-backend ./apps/bot-backend

# Install dependencies and build shared packages & bot-backend
RUN npm ci
RUN npm run build --workspace=@rebecca/types --workspace=@rebecca/db --workspace=@rebecca/persona --workspace=bot-backend

# Stage 2: Minimal production image
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy root package manifests for runtime module resolution
COPY package*.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY packages/persona/package.json ./packages/persona/
COPY packages/grpc-schemas ./packages/grpc-schemas
COPY apps/bot-backend/package.json ./apps/bot-backend/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/persona/dist ./packages/persona/dist
COPY --from=builder /app/apps/bot-backend/dist ./apps/bot-backend/dist
COPY --from=builder /app/apps/bot-backend/public ./apps/bot-backend/public

WORKDIR /app/apps/bot-backend
ENV PORT=8080
EXPOSE 8080 50051

CMD ["node", "dist/index.js"]

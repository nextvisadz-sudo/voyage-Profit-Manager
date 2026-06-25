# Stage 1: Build the application
FROM node:20-slim AS builder

# Install pnpm globally and system libraries required by @napi-rs/canvas
# (libcairo, libpango, libpixman are needed for canvas native binary)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libpixman-1-0 \
    libfreetype6 \
    libharfbuzz0b \
    libjpeg62-turbo \
    libpng16-16 \
    libgif7 \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm

WORKDIR /app

# Copy lockfile and workspace configurations
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json tsconfig.base.json ./

# Copy packages' package.json files to cache dependency installation stage
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/travel-website/package.json ./artifacts/travel-website/
COPY artifacts/admin-dashboard/package.json ./artifacts/admin-dashboard/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/

# Configure pnpm to download linux-x64 binaries for Rollup/esbuild on Debian/slim
RUN pnpm config set supportedArchitectures --json '{"os": ["linux"], "cpu": ["x64"]}'

# Install dependencies (frozen-lockfile checks that lockfile is correct)
# Use --no-frozen-lockfile because we've changed package.json (added @napi-rs/canvas)
RUN pnpm install

# Copy all source files
COPY . .

# Build only the production-relevant workspaces (api-server, travel-website, and dependencies)
RUN pnpm --filter @workspace/api-server --filter @workspace/travel-website run build

# Stage 2: Final lightweight image
FROM node:20-slim AS runner

# Install runtime system libraries required by @napi-rs/canvas
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libpixman-1-0 \
    libfreetype6 \
    libharfbuzz0b \
    libjpeg62-turbo \
    libpng16-16 \
    libgif7 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application and required production node_modules/files
COPY --from=builder /app /app

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

# Start Express Backend (which serves both backend endpoints and static client SPA)
CMD ["node", "artifacts/api-server/dist/index.mjs"]

# Single-service build for Railway.
# Builds the SpaceX Pre-IPO frontend (Vite) and the API server (esbuild),
# then runs the API server, which also serves the built frontend as static
# files and handles SPA routing. One process, one port, one Railway service.
#
# Single-stage on purpose: the API server's bundle externalizes a few
# packages (e.g. nodemailer) that must still be resolvable from
# node_modules at runtime, so the full pnpm-installed workspace is kept
# rather than trying to hand-prune it.

FROM node:24-slim
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

COPY . .
# --ignore-scripts bypasses pnpm 11's interactive build-approval prompt in CI;
# pnpm rebuild esbuild then runs esbuild's postinstall to build its native binary.
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm rebuild esbuild

# Build the frontend (outputs to artifacts/spacex-platform/dist/public)
RUN pnpm --filter @workspace/spacex-platform run build

# Build the API server (outputs to artifacts/api-server/dist)
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production
# Railway injects PORT at runtime; the server reads process.env.PORT.
EXPOSE 8080
CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]

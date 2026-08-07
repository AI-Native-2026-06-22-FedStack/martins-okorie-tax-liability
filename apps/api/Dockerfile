# syntax=docker/dockerfile:1

ARG TAXPULSE_IMAGE_PLATFORM=linux/amd64

FROM --platform=${TAXPULSE_IMAGE_PLATFORM} node:24.17.0-trixie-slim@sha256:b97b310afd056455616802dfddbd6be02c13a345cc64b635e3af3e83e4d902e3 AS build
WORKDIR /workspace

COPY package*.json ./
COPY tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-schemas/package.json packages/shared-schemas/package.json
RUN npm ci --workspace=@taxpulse/api

COPY apps/api apps/api
COPY packages/shared-schemas packages/shared-schemas
COPY src/typescript src/typescript
COPY shared/redaction-config.json shared/redaction-config.json
WORKDIR /workspace/apps/api
RUN ./node_modules/.bin/esbuild src/server.ts \
  --bundle \
  --platform=node \
  --target=node24 \
  --format=esm \
  --outfile=dist/server.js \
  --packages=external
RUN node -e "const fs=require('fs'); fs.writeFileSync('dist/healthcheck.js', 'import http from \"node:http\";\\nconst port = Number(process.env.PORT || 3000);\\nconst req = http.request({ hostname: \"127.0.0.1\", port, path: \"/health\", timeout: 2500 }, (res) => { process.exit(res.statusCode && res.statusCode < 500 ? 0 : 1); });\\nreq.on(\"timeout\", () => req.destroy(new Error(\"timeout\")));\\nreq.on(\"error\", () => process.exit(1));\\nreq.end();\\n');"
WORKDIR /workspace
RUN ./apps/api/node_modules/.bin/esbuild \
  packages/shared-schemas/src/index.ts \
  packages/shared-schemas/src/events/stageChanged.ts \
  packages/shared-schemas/src/events/presentToClient.ts \
  --platform=node \
  --target=node24 \
  --format=esm \
  --outbase=packages/shared-schemas/src \
  --outdir=packages/shared-schemas/dist
RUN node -e "const fs=require('fs'); const p='packages/shared-schemas/package.json'; const pkg=JSON.parse(fs.readFileSync(p, 'utf8')); pkg.main='./dist/index.js'; pkg.types='./src/index.ts'; pkg.exports={'.':{types:'./src/index.ts', import:'./dist/index.js'}, './events/stageChanged':{types:'./src/events/stageChanged.ts', import:'./dist/events/stageChanged.js'}, './calculation.schema.json':'./calculation.schema.json'}; fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\\n');"
RUN npm prune --omit=dev --workspaces --include-workspace-root

FROM --platform=${TAXPULSE_IMAGE_PLATFORM} gcr.io/distroless/nodejs24-debian13:nonroot@sha256:f987682b3ea8d8e22497cb95edc5014d793612f7064e43df8104394db0ce19fe AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/node_modules ./node_modules
COPY --from=build /workspace/apps/api/package.json ./package.json
COPY --from=build /workspace/apps/api/dist ./dist
COPY --from=build /workspace/packages/shared-schemas ./packages/shared-schemas
COPY --from=build /workspace/shared/redaction-config.json /shared/redaction-config.json

EXPOSE 3000
USER nonroot
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 CMD ["/nodejs/bin/node", "/app/dist/healthcheck.js"]
CMD ["dist/server.js"]

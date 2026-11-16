# dashboard.sustenaut.eu: built here, so the image holds the server as one bundled file
# (dist/server.mjs), its CSS and fonts, and nothing else: no node_modules, no secret. Its
# settings and keys come from the Secret dashboard-secrets at run time (k8s/app.yaml).
FROM docker.io/library/node:22-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY scripts/build.mjs scripts/
COPY src/ src/
RUN npm run build

FROM docker.io/library/node:22-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /src/dist/ ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]

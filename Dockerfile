FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY apps/corsair-admin/package.json apps/corsair-admin/package.json
COPY packages packages
COPY apps/corsair-admin apps/corsair-admin
RUN npm install
RUN npm run build --workspace @corsair-platform/admin

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/apps/corsair-admin/package.json apps/corsair-admin/package.json
COPY --from=build /app/apps/corsair-admin/dist apps/corsair-admin/dist
RUN npm install --omit=dev
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@corsair-platform/admin"]

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared-schemas ./packages/shared-schemas
RUN npm install
COPY apps/api ./apps/api
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/api"]

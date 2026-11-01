# School Net Academy — image de production (API Express + SPA compilée)
FROM node:22-alpine

WORKDIR /app

# Dépendances (cache Docker)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Code + compilation de l'interface
COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=3000 \
    DB_FILE=/data/school-net.db

RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000

# La base est créée et remplie automatiquement au premier démarrage si elle est vide.
CMD ["npm", "start"]

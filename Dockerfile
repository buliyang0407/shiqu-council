FROM node:latest

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5173

COPY package.json ./
COPY server ./server
COPY public ./public

EXPOSE 5173

CMD ["node", "server/index.mjs"]

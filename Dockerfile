FROM node:12.13.1 AS install-deps

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm install

FROM node:12.13.1 AS serve-api

ENV PORT 3000
ENV NODE_ENV development

WORKDIR /app

COPY --from=install-deps /app/node_modules node_modules
COPY . ./

EXPOSE 3001

CMD ["node", "app.js"]

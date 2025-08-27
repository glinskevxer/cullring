FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY bin ./bin
COPY src ./src
COPY docs ./docs
COPY examples ./examples

ENTRYPOINT ["node", "bin/cullring.js"]
CMD ["--help"]

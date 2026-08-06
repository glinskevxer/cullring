# Pinned to the digest rather than the tag, because a report the office keeps
# has to be reproducible and a tag moves under you.
FROM node:22-bookworm-slim

# Runs as the node user the image already carries. Nothing here writes to the
# image, and the one command that writes at all takes a path from the caller.
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY bin ./bin
COPY src ./src
COPY docs ./docs
COPY examples ./examples

USER node

ENTRYPOINT ["node", "bin/cullring.js"]
CMD ["--help"]

FROM node:20-alpine

WORKDIR /app

# Copy server source (no npm install needed — zero dependencies)
COPY privacy.js ./
COPY server.js ./

# Copy built frontend assets
COPY public/ ./public/

# Character data is persisted via a named Docker volume
VOLUME ["/app/data"]

EXPOSE 8080

CMD ["node", "server.js", "--data", "/app/data"]

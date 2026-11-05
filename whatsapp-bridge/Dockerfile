FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --chown=node:node *.js ./
RUN mkdir /app/auth_info_baileys && chown node:node /app/auth_info_baileys
USER node
CMD ["node", "server.js"]

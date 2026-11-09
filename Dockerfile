FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js seed.js akun.js ./
COPY public ./public
RUN mkdir -p data && chown -R node:node /app
USER node
ENV NODE_ENV=production TZ=Asia/Jakarta PORT=3000
VOLUME /app/data
EXPOSE 3000
CMD ["node","server.js"]
# syntax=docker/dockerfile:1
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY . ./
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ENV NITRO_PRESET=node-server
RUN npm run build

FROM nginx:1.27-alpine

# Install Node.js for Nitro server
RUN apk add --no-cache nodejs

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/.output /app/.output

# The Nitro server will listen on 3000
ENV PORT=3000
EXPOSE 80

# Start both Node server and Nginx
CMD node /app/.output/server/index.mjs & nginx -g "daemon off;"

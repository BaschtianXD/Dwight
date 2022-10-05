ARG NODE_ENV=production

FROM node:18-bullseye
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsodium-dev \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=${NODE_ENV}
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install
COPY . .
RUN npm run build
USER 405
CMD ["npm", "start"]

EXPOSE 8080

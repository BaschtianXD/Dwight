ARG NODE_ENV=production

FROM node:18-bullseye
RUN apt-get -qq update && apt-get install -qq \
    ffmpeg \
    libsodium-dev \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=${NODE_ENV}
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --silent
COPY . .
RUN npm run build
EXPOSE 8080

CMD ["npm", "start"]

# Base image
FROM node:22-alpine

# 設定時區為台北時間
RUN apk add --no-cache tzdata
ENV TZ=Asia/Taipei

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json /usr/src/app/
RUN npm ci --omit=dev

# Bundle app source
COPY . /usr/src/app

# Declaring PROT in containers
ENV PORT=3009
EXPOSE 3009
CMD [ "npm", "start" ]


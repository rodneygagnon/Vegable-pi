FROM arm32v7/node:11.3.0

WORKDIR /usr/app

COPY package.json .

RUN npm install

COPY . .

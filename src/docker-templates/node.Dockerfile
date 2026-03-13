FROM node:{{version}}-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE {{port}}

CMD ["npm", "run", "dev"]

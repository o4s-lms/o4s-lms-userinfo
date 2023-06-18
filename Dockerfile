FROM node:18-alpine

RUN apk --update --no-cache add curl

# set working directory
WORKDIR /app

# add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

# install app dependencies
COPY package.json ./
RUN npm install --silent

# add app
COPY . ./
RUN npm run auth:generate
RUN npm run lms:generate

EXPOSE 8002

# start app
CMD ["npm", "run", "start"]
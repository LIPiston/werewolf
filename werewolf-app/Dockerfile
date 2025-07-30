FROM node:18-alpine

WORKDIR /app

COPY package.json ./

RUN yarn config set registry https://registry.npmmirror.com/ && \
    yarn install --verbose


COPY . .

ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN yarn build

EXPOSE 3000

# Health check removed for simplicity. User may need to manually restart frontend container.

CMD ["yarn", "start"]

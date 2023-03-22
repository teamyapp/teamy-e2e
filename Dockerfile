FROM mcr.microsoft.com/playwright:v1.31.0-focal

WORKDIR /drone

COPY . .

RUN yarn install

CMD ["yarn", "test"]

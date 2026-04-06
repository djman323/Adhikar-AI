FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . ./

ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
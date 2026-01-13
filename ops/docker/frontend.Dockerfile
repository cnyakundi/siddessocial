# Siddes frontend (Next.js) dev image
# Assumes repo has `frontend/` with `package.json`.
FROM node:20-alpine

WORKDIR /app/frontend

COPY frontend/package*.json /app/frontend/
RUN npm ci || npm install

COPY frontend /app/frontend

EXPOSE 3000

CMD ["sh", "-lc", "npm run dev -- -H 0.0.0.0 -p 3000"]

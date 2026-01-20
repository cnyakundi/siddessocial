# Siddes backend (Django) production image
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       build-essential \
       libpq-dev \
       curl \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN python -m pip install --upgrade pip \
  && pip install -r /app/backend/requirements.txt

COPY backend /app/backend

# Ensure the prod start script is executable
RUN chmod +x /app/backend/start_prod.sh

EXPOSE 8000

CMD ["bash", "-lc", "./start_prod.sh"]

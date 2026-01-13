# Siddes backend (Django) dev image
# Assumes repo has `backend/` with `requirements.txt` and `manage.py`.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1

WORKDIR /app/backend

RUN apt-get update && apt-get install -y --no-install-recommends       build-essential       libpq-dev       curl     && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN python -m pip install --upgrade pip && pip install -r /app/backend/requirements.txt

COPY backend /app/backend

EXPOSE 8000

CMD ["sh", "-lc", "python manage.py runserver 0.0.0.0:8000"]

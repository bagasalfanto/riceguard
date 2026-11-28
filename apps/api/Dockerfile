FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY packages/riceguard_calc /app/packages/riceguard_calc
COPY apps/api /app/apps/api
COPY dataset/geo/provinsi-38.min.geojson /app/dataset/geo/provinsi-38.min.geojson

RUN pip install --no-cache-dir -e /app/packages/riceguard_calc -e /app/apps/api

WORKDIR /app/apps/api
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

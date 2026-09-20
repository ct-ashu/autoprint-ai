# Render builds the website, then runs Flask and the compiled UI on one port.
FROM node:24-bookworm-slim AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm --prefix frontend ci
COPY frontend/ ./frontend/
COPY scripts/prepare-pdf.mjs ./scripts/prepare-pdf.mjs
RUN npm --prefix frontend run build

FROM python:3.12-slim-bookworm AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATA_DIR=/tmp/autoprint
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/
COPY --from=frontend-build /build/dist/client/ ./dist/client/
RUN useradd --create-home --uid 10001 autoprint
USER autoprint
WORKDIR /app/backend
EXPOSE 10000
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]

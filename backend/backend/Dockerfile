# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt

RUN python - <<'PY'
import pathlib
raw = pathlib.Path("/app/requirements.txt").read_bytes()
try:
    text = raw.decode("utf-8-sig")
except UnicodeError:
    text = raw.decode("utf-16")
pathlib.Path("/tmp/requirements.txt").write_text(text, encoding="utf-8")
PY

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r /tmp/requirements.txt

COPY . /app

RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]

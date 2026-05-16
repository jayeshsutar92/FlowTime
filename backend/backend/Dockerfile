FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt

RUN python - <<'PY'
import pathlib
raw = pathlib.Path("/app/requirements.txt").read_bytes()
try:
    text = raw.decode("utf-16")
except UnicodeError:
    text = raw.decode("utf-8")
pathlib.Path("/tmp/requirements.txt").write_text(text, encoding="utf-8")
PY

RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY . /app

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

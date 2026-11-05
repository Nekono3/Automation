FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.lock ./
RUN pip install --no-cache-dir --require-hashes -r requirements.lock
COPY app app
COPY migrations migrations
COPY scripts scripts
COPY alembic.ini ./
RUN useradd --uid 10001 --create-home crm && mkdir -p /app/private_documents /app/static/guides && chown -R crm:crm /app
USER crm
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]

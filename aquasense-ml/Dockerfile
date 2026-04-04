FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY app.py train.py ./
COPY data/ ./data/
COPY models/ ./models/

# Non-root user
RUN addgroup --system aqua && adduser --system --ingroup aqua aqua
RUN chown -R aqua:aqua /app
USER aqua

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

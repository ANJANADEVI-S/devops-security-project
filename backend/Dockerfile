FROM python:3.11-slim

WORKDIR /app

# Install deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Don't run as root
RUN adduser --disabled-password --gecos '' appuser
USER appuser

EXPOSE 5000

CMD ["python", "app.py"]
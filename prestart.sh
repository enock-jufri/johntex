#!/bin/bash
set -e

mkdir -p /app/logs

echo "Waiting for database..."
python wait_for_db.py

echo "Running database migrations..."
alembic upgrade head

if [ "${SEED_DB:-false}" = "true" ]; then
    echo "Seeding database..."
    python seed_db.py
fi

echo "Prestart complete."

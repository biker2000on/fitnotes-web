#!/bin/bash
# Start PostgreSQL 17 for FitNotes development

# Check if container exists
if podman container exists fitnotes-db; then
    echo "Starting existing fitnotes-db container..."
    podman start fitnotes-db
else
    echo "Creating new fitnotes-db container..."
    podman run -d \
        --name fitnotes-db \
        -e POSTGRES_USER=fitnotes \
        -e POSTGRES_PASSWORD=devpassword \
        -e POSTGRES_DB=fitnotes \
        -p 5432:5432 \
        -v fitnotes-pgdata:/var/lib/postgresql/data \
        postgres:17-alpine
fi

echo "Waiting for PostgreSQL to be ready..."
sleep 3
podman exec fitnotes-db pg_isready -U fitnotes && echo "PostgreSQL is ready!"

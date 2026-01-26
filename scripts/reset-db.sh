#!/bin/bash
# Reset PostgreSQL database (WARNING: destroys all data)
read -p "This will DELETE ALL DATA. Are you sure? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    podman stop fitnotes-db 2>/dev/null
    podman rm fitnotes-db 2>/dev/null
    podman volume rm fitnotes-pgdata 2>/dev/null
    echo "Database reset complete. Run start-db.sh to create a fresh database."
fi

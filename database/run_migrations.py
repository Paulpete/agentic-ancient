import os
from connection import db

def run_migrations():
    migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
    migration_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith('.sql')])

    for migration_file in migration_files:
        print(f'Running migration: {migration_file}')
        with open(os.path.join(migrations_dir, migration_file), 'r') as f:
            sql = f.read()
            db.query(sql)

if __name__ == '__main__':
    run_migrations()

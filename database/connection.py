import os
import psycopg2
from psycopg2 import pool

class Database:
    def __init__(self):
        self.pool = psycopg2.pool.SimpleConnectionPool(
            1,
            20,
            user=os.environ.get('POSTGRES_USER'),
            password=os.environ.get('POSTGRES_PASSWORD'),
            host=os.environ.get('POSTGRES_HOST'),
            port=os.environ.get('POSTGRES_PORT'),
            database=os.environ.get('POSTGRES_DB')
        )

    def get_connection(self):
        return self.pool.getconn()

    def release_connection(self, conn):
        self.pool.putconn(conn)

    def query(self, text, params=None):
        conn = self.get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(text, params)
                if cursor.description:
                    return cursor.fetchall()
        finally:
            self.release_connection(conn)

    def close_all_connections(self):
        self.pool.closeall()

db = Database()

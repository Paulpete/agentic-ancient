# Agentic-Ancient-Agent

This project is a Python-based agent that uses a PostgreSQL database to manage and track data related to sweeps, allocations, staking, and more.

## Setup

1.  **Install dependencies:**

    ```bash
    pip install -r requirements.txt
    ```

2.  **Set up environment variables:**

    Create a `.env` file in the root of the project with the following variables:

    ```
    POSTGRES_USER=your_username
    POSTGRES_PASSWORD=your_password
    POSTGRES_HOST=your_host
    POSTGRES_PORT=your_port
    POSTGRES_DB=your_database
    ```

3.  **Run database migrations:**

    ```bash
    python database/run_migrations.py
    ```

## Running Tests

To run the tests, execute the following command:

```bash
python tests/test_database.py
```

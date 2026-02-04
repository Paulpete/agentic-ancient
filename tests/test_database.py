import unittest
from database.connection import db

class TestDatabase(unittest.TestCase):

    def test_connection(self):
        # This will raise an exception if it can't connect
        conn = db.get_connection()
        self.assertIsNotNone(conn)
        db.release_connection(conn)

    def test_migrations(self):
        # Running migrations should not raise exceptions
        from database.run_migrations import run_migrations
        run_migrations()

        # Verify that tables were created
        res = db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        tables = [table[0] for table in res]
        self.assertIn('sweeps', tables)
        self.assertIn('allocations', tables)
        self.assertIn('staking_positions', tables)
        self.assertIn('reinvestments', tables)
        self.assertIn('audit_log', tables)
        self.assertIn('sacred_logic_versions', tables)
        self.assertIn('chain_deployments', tables)
        self.assertIn('cross_chain_sync', tables)
        self.assertIn('nft_fusions', tables)
        self.assertIn('treasury_claims', tables)
        self.assertIn('mutation_logs', tables)
        self.assertIn('immutable_audit_log', tables)

if __name__ == '__main__':
    unittest.main()

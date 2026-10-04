-- Runs once when the Postgres volume is first created.
-- Separate database for the API integration tests.
CREATE DATABASE sentinel_test OWNER sentinel;

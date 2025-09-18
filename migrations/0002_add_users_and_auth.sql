-- Migration: Add users table and user authentication support
-- This migration adds user accounts and associates existing data with users

PRAGMA foreign_keys = ON;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  google_id TEXT UNIQUE,
  profile_picture TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login INTEGER
);

-- Add user_id column to projects table
ALTER TABLE projects ADD COLUMN user_id TEXT;

-- Add user_id column to files table  
ALTER TABLE files ADD COLUMN user_id TEXT;

-- Add user_id column to results table
ALTER TABLE results ADD COLUMN user_id TEXT;

-- Add foreign key constraints for user relationships
-- Note: SQLite doesn't support adding foreign key constraints to existing tables
-- We'll handle this in the application layer for now

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id);

-- Create composite indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_files_user_project ON files(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_results_user_project ON results(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_results_user_file ON results(user_id, file_id);
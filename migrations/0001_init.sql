PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  size INTEGER,
  mime_type TEXT,
  status TEXT,
  preview TEXT,
  original_preview TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  project_id TEXT,
  extracted_text TEXT,
  layout_preserved TEXT,
  detected_language TEXT,
  confidence REAL,
  document_type TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_summaries (
  project_id TEXT PRIMARY KEY,
  generated_at INTEGER NOT NULL,
  summary TEXT,
  toc TEXT,
  chapters TEXT,
  proofreading_notes TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_results_project ON results(project_id);
CREATE INDEX IF NOT EXISTS idx_results_file ON results(file_id);

-- PostgreSQL schema DDL for Search Engine Indexer components

-- 1. Terms table: stores unique stemmed terms and their document frequency
CREATE TABLE IF NOT EXISTS terms (
    term_id SERIAL PRIMARY KEY,
    term TEXT UNIQUE NOT NULL,
    doc_frequency INT DEFAULT 0 NOT NULL
);

-- Hash index on term for fast O(1) exact lookups
CREATE INDEX IF NOT EXISTS idx_terms_term ON terms USING hash (term);

-- 2. Postings table: positional inverted index postings list
CREATE TABLE IF NOT EXISTS postings (
    term_id INT REFERENCES terms(term_id) ON DELETE CASCADE,
    doc_id INT REFERENCES crawled_pages(id) ON DELETE CASCADE,
    tf_title INT DEFAULT 0 NOT NULL,
    tf_heading INT DEFAULT 0 NOT NULL,
    tf_body INT DEFAULT 0 NOT NULL,
    positions INT[] NOT NULL,
    PRIMARY KEY (term_id, doc_id)
);

-- B-tree index on doc_id for fast document-level deletions during re-indexing / incremental updates
CREATE INDEX IF NOT EXISTS idx_postings_doc_id ON postings (doc_id);

-- 3. Index Metadata table: stores corpus statistics for BM25 calculation
CREATE TABLE IF NOT EXISTS index_meta (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- restricts table to a single row
    doc_count INT DEFAULT 0 NOT NULL,
    avg_doc_length DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
    last_indexed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

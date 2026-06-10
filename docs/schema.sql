-- Database schema for Lightning Search Engine

-- 1. Core Web Crawler Tables (Source Data)
CREATE TABLE IF NOT EXISTS urls (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    domain TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crawled_pages (
    id SERIAL PRIMARY KEY,
    url_id INT REFERENCES urls(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    canonical_url TEXT,
    headings JSONB,
    text_content TEXT NOT NULL,
    doc_length INT DEFAULT 0,
    word_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    indexed_at TIMESTAMP,
    authority_score FLOAT DEFAULT 0.0,
    doc_fingerprint TEXT
);

-- 2. Positional Inverted Index Tables
CREATE TABLE IF NOT EXISTS terms (
    term_id SERIAL PRIMARY KEY,
    term TEXT UNIQUE NOT NULL,
    doc_frequency INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS postings (
    term_id INT REFERENCES terms(term_id) ON DELETE CASCADE,
    doc_id INT REFERENCES crawled_pages(id) ON DELETE CASCADE,
    tf_title INT DEFAULT 0,
    tf_heading INT DEFAULT 0,
    tf_body INT DEFAULT 0,
    positions BYTEA NOT NULL, -- VByte compressed delta-encoded position values
    segment TEXT DEFAULT 'hot', -- 'hot' for recent documents, 'cold' for archive
    PRIMARY KEY (term_id, doc_id)
);

-- 3. Inverted Index Metadata
CREATE TABLE IF NOT EXISTS index_meta (
    id INT PRIMARY KEY,
    doc_count INT DEFAULT 0,
    avg_doc_length FLOAT DEFAULT 0.0,
    last_indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Database Indices for Performance
CREATE INDEX IF NOT EXISTS idx_terms_term ON terms(term);
CREATE INDEX IF NOT EXISTS idx_postings_doc_id ON postings(doc_id);
CREATE INDEX IF NOT EXISTS idx_postings_segment ON postings(segment);
CREATE INDEX IF NOT EXISTS idx_crawled_pages_active_indexed ON crawled_pages(is_active, indexed_at);

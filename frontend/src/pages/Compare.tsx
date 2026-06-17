import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, type SearchResult } from '../api/client';
import MetricsCard from '../components/MetricsCard';
import CompareResultCard from '../components/CompareResultCard';

export default function Compare() {
  const [query, setQuery] = useState('');
  const [lightningResults, setLightningResults] = useState<SearchResult[] | null>(null);
  const [esResults, setEsResults] = useState<SearchResult[] | null>(null);

  const [lightningMeta, setLightningMeta] = useState<{ tookMs: number; totalHits: number } | null>(null);
  const [esMeta, setEsMeta] = useState<{ tookMs: number; totalHits: number } | null>(null);

  const [lightningLoading, setLightningLoading] = useState(false);
  const [esLoading, setEsLoading] = useState(false);

  const [lightningError, setLightningError] = useState<string | null>(null);
  const [esError, setEsError] = useState<string | null>(null);

  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setHasSearched(true);
    setLightningLoading(true);
    setEsLoading(true);
    setLightningError(null);
    setEsError(null);
    setLightningResults(null);
    setEsResults(null);
    setLightningMeta(null);
    setEsMeta(null);

    const lightningStart = performance.now();
    apiClient.search(trimmedQuery, 1, 10)
      .then((val) => {
        const elapsed = performance.now() - lightningStart;
        setLightningResults(val.results);
        setLightningMeta({
          tookMs: elapsed,
          totalHits: val.total_hits
        });
      })
      .catch((err) => {
        console.error('Lightning search failed:', err);
        setLightningError(err.message || 'Failed to search Lightning Engine');
      })
      .finally(() => {
        setLightningLoading(false);
      });

    const esStart = performance.now();
    apiClient.esSearch(trimmedQuery, 1, 10)
      .then((val) => {
        const elapsed = performance.now() - esStart;
        setEsResults(val.results);
        setEsMeta({
          tookMs: elapsed,
          totalHits: val.total_hits
        });
      })
      .catch((err) => {
        console.error('Elasticsearch search failed:', err);
        setEsError(err.message || 'Failed to search Elasticsearch');
      })
      .finally(() => {
        setEsLoading(false);
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const bothLoaded = lightningMeta !== null && esMeta !== null;
  const lightningWinner = bothLoaded && lightningMeta!.tookMs < esMeta!.tookMs;
  const esWinner = bothLoaded && esMeta!.tookMs < lightningMeta!.tookMs;

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header} className="glass">
        <div style={styles.headerContent}>
          <h1 style={styles.headerTitle}> Lightning vs Elasticsearch</h1>
          <Link to="/" style={styles.backLink}>← Back to Home</Link>
        </div>
      </header>

      {/* Main Container */}
      <main style={styles.main}>
        {/* Search Box */}
        <div style={styles.searchContainer}>
          <div style={styles.inputWrapper}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter search query..."
              style={styles.input}
            />
          </div>
          <button onClick={handleSearch} style={styles.searchButton}>
            Compare Engines
          </button>
        </div>

        {/* Comparison Panels */}
        {hasSearched && (
          <div style={styles.panelsGrid}>
            {/* Lightning Panel */}
            <div style={styles.panel}>
              <MetricsCard
                engine="lightning"
                tookMs={lightningMeta ? lightningMeta.tookMs : null}
                totalHits={lightningMeta ? lightningMeta.totalHits : null}
                isWinner={lightningWinner}
                loading={lightningLoading}
              />

              <div style={styles.resultsList}>
                {lightningLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} style={styles.skeletonCard} className="glass">
                      <div style={styles.skeletonTextShort}></div>
                      <div style={styles.skeletonTextLong}></div>
                    </div>
                  ))
                ) : lightningError ? (
                  <div style={styles.errorCard} className="glass">
                    <p style={{ color: 'hsl(var(--error))' }}>{lightningError}</p>
                  </div>
                ) : lightningResults && lightningResults.length === 0 ? (
                  <div style={styles.emptyCard} className="glass">
                    <p>No results found</p>
                  </div>
                ) : (
                  lightningResults?.map((res, idx) => (
                    <CompareResultCard key={res.id} result={res} rank={idx + 1} />
                  ))
                )}
              </div>
            </div>

            {/* Elasticsearch Panel */}
            <div style={styles.panel}>
              <MetricsCard
                engine="elasticsearch"
                tookMs={esMeta ? esMeta.tookMs : null}
                totalHits={esMeta ? esMeta.totalHits : null}
                isWinner={esWinner}
                loading={esLoading}
              />

              <div style={styles.resultsList}>
                {esLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} style={styles.skeletonCard} className="glass">
                      <div style={styles.skeletonTextShort}></div>
                      <div style={styles.skeletonTextLong}></div>
                    </div>
                  ))
                ) : esError ? (
                  <div style={styles.errorCard} className="glass">
                    <p style={{ color: 'hsl(var(--error))' }}>{esError}</p>
                  </div>
                ) : esResults && esResults.length === 0 ? (
                  <div style={styles.emptyCard} className="glass">
                    <p>No results found</p>
                  </div>
                ) : (
                  esResults?.map((res, idx) => (
                    <CompareResultCard key={res.id} result={res} rank={idx + 1} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'hsl(var(--bg-main))',
    color: 'hsl(var(--text-main))',
  },
  header: {
    padding: '1.25rem 2rem',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    borderBottom: '1px solid hsla(var(--border-color), 0.5)',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerTitle: {
    fontSize: '1.35rem',
    fontWeight: 700,
    letterSpacing: '-0.04em',
  },
  backLink: {
    fontSize: '0.9rem',
    color: 'hsl(var(--text-muted))',
    border: '1px solid hsl(var(--border-color))',
    padding: '0.4rem 0.9rem',
    borderRadius: '8px',
    transition: 'all 0.15s ease',
  },
  main: {
    flex: 1,
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: '2rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2.5rem',
  },
  searchContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    width: '100%',
    maxWidth: '650px',
    margin: '0 auto',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'hsla(var(--bg-card), 0.6)',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: '24px',
    padding: '0.6rem 1.2rem',
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'hsl(var(--text-main))',
    fontSize: '1.1rem',
    fontFamily: 'var(--font-sans)',
  },
  searchButton: {
    backgroundColor: 'hsl(var(--secondary))',
    color: 'hsl(var(--bg-main))',
    fontWeight: 600,
    padding: '0.6rem 2rem',
    borderRadius: '20px',
    fontSize: '0.95rem',
    transition: 'all 0.2s ease',
  },
  panelsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem',
    width: '100%',
    alignItems: 'start',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    width: '100%',
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
  },
  errorCard: {
    padding: '1.5rem',
    borderRadius: '12px',
    textAlign: 'center',
  },
  emptyCard: {
    padding: '1.5rem',
    borderRadius: '12px',
    textAlign: 'center',
    color: 'hsl(var(--text-subtle))',
  },
  skeletonCard: {
    padding: '1rem',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  skeletonTextShort: {
    height: '16px',
    backgroundColor: 'hsla(var(--text-subtle), 0.1)',
    borderRadius: '4px',
    width: '30%',
  },
  skeletonTextLong: {
    height: '14px',
    backgroundColor: 'hsla(var(--text-subtle), 0.07)',
    borderRadius: '4px',
    width: '90%',
  },
};

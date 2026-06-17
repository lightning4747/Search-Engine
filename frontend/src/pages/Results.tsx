import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiClient, type SearchResult } from '../api/client';

export default function Results() {
  const [searchParams, setSearchParams] = useSearchParams();

  const queryParam = searchParams.get('q') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  const [inputVal, setInputVal] = useState(queryParam);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [tookMs, setTookMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestRef = useRef<HTMLDivElement>(null);

  // Domain filter state
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  // Debug score view
  const [debugMode, setDebugMode] = useState(false);

  // Fetch search results on queryParam or pageParam change
  useEffect(() => {
    if (!queryParam.trim()) {
      setResults([]);
      setTotalHits(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedDomain(null); // Reset domain filter on query change

    apiClient.search(queryParam, pageParam)
      .then(res => {
        setResults(res.results);
        setTotalHits(res.total_hits);
        setTookMs(res.took_ms);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'An error occurred during search.');
        setLoading(false);
      });
  }, [queryParam, pageParam]);

  // Autocomplete debounce
  useEffect(() => {
    if (inputVal.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const handler = setTimeout(() => {
      apiClient.suggest(inputVal.trim())
        .then(res => setSuggestions(res))
        .catch(() => {});
    }, 200);

    return () => clearTimeout(handler);
  }, [inputVal]);

  // Click outside suggestions list
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetQuery = activeIndex >= 0 && suggestions[activeIndex] 
      ? suggestions[activeIndex] 
      : inputVal;
    if (targetQuery.trim()) {
      setShowSuggestions(false);
      setSearchParams({ q: targetQuery.trim(), page: '1' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
    }
  };

  // Pagination navigation helpers
  const handlePageChange = (newPage: number) => {
    setSearchParams({ q: queryParam, page: String(newPage) });
  };

  // Derive unique domains from the current result set
  const domains = Array.from(new Set(results.map(r => r.domain)));

  // Filter results locally by selected domain
  const filteredResults = selectedDomain 
    ? results.filter(r => r.domain === selectedDomain)
    : results;

  const limit = 10;
  const totalPages = Math.ceil(totalHits / limit);

  return (
    <div style={styles.page}>
      {/* Top Search Header */}
      <header style={styles.header} className="glass">
        <div style={styles.headerContent}>
          <Link to="/" style={styles.logoLink}>
            Lightning <span style={styles.logoDot}>Search</span>
          </Link>

          <div ref={suggestRef} style={styles.searchBox}>
            <form onSubmit={handleSearchSubmit} style={{ width: '100%' }}>
              <div style={styles.inputWrapper}>
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => {
                    setInputVal(e.target.value);
                    setShowSuggestions(true);
                    setActiveIndex(-1);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search..."
                  style={styles.input}
                />
                {inputVal && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputVal('');
                      setSuggestions([]);
                    }}
                    style={styles.clearBtn}
                  >
                    ✕
                  </button>
                )}
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <ul role="listbox" style={styles.suggestList} className="glass">
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={suggestion}
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setInputVal(suggestion);
                        setShowSuggestions(false);
                        setSearchParams({ q: suggestion, page: '1' });
                      }}
                      style={{
                        ...styles.suggestItem,
                        ...(index === activeIndex ? styles.suggestItemActive : {})
                      }}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </form>
          </div>

          <div style={styles.headerActions}>
            <button 
              onClick={() => setDebugMode(prev => !prev)} 
              style={{
                ...styles.debugBtn,
                ...(debugMode ? styles.debugBtnActive : {})
              }}
            >
              {debugMode ? 'Hide Score' : 'Debug Score'}
            </button>
            <Link to="/compare" style={styles.compareLink}>⚡ Compare</Link>
            <Link to="/stats" style={styles.statsLink}>Stats</Link>
          </div>
        </div>
      </header>

      {/* Main Results Grid */}
      <main style={styles.mainContainer} className="container">
        {loading ? (
          // Loading Skeleton
          <div style={styles.skeletonContainer}>
            {[1, 2, 3].map(i => (
              <div key={i} style={styles.skeletonCard} className="glass">
                <div style={styles.skeletonTitle}></div>
                <div style={styles.skeletonSnippet}></div>
                <div style={styles.skeletonSnippetShort}></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={styles.errorContainer} className="glass">
            <p>{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div style={styles.emptyContainer} className="glass">
            <h3>No results found for "{queryParam}"</h3>
            <p>Check spelling, try different keywords, or remove search filters.</p>
          </div>
        ) : (
          <div style={styles.resultsGrid}>
            {/* Left Column: Results List */}
            <div style={styles.resultsList}>
              <div style={styles.metaSummary}>
                About {totalHits} results ({tookMs} ms)
                {selectedDomain && (
                  <span style={styles.filterTag}>
                    filtered by {selectedDomain}{' '}
                    <button onClick={() => setSelectedDomain(null)} style={styles.clearFilterBtn}>✕</button>
                  </span>
                )}
              </div>

              {filteredResults.map(result => (
                <article key={result.id} style={styles.card} className="glass animate-fade-in">
                  <header style={styles.cardHeader}>
                    <div style={styles.urlRow}>
                      <span style={styles.domainBadge}>{result.domain}</span>
                      <span style={styles.urlText}>{result.url}</span>
                    </div>
                    <Link to={`/document/${result.id}`} style={styles.cardTitle}>
                      {result.title || 'Untitled Page'}
                    </Link>
                  </header>
                  <p 
                    style={styles.snippet}
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                  {debugMode && (
                    <div style={styles.debugRow}>
                      <span>BM25 Weighted Score: <strong style={{ color: 'hsl(var(--primary))' }}>{result.score}</strong></span>
                    </div>
                  )}
                </article>
              ))}

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={styles.pagination}>
                  <button
                    disabled={pageParam === 1}
                    onClick={() => handlePageChange(pageParam - 1)}
                    style={{
                      ...styles.pageBtn,
                      ...(pageParam === 1 ? styles.pageBtnDisabled : {})
                    }}
                  >
                    ← Previous
                  </button>
                  
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    // Limit number of shown pages for clean UI
                    if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - pageParam) <= 2) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          style={{
                            ...styles.pageNumberBtn,
                            ...(pageParam === pageNum ? styles.pageNumberBtnActive : {})
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === 2 || pageNum === totalPages - 1) {
                      return <span key={pageNum} style={{ color: 'hsl(var(--text-subtle))' }}>...</span>;
                    }
                    return null;
                  })}

                  <button
                    disabled={pageParam === totalPages}
                    onClick={() => handlePageChange(pageParam + 1)}
                    style={{
                      ...styles.pageBtn,
                      ...(pageParam === totalPages ? styles.pageBtnDisabled : {})
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Sidebar (Domain filters) */}
            <aside style={styles.sidebar}>
              <div style={styles.sidebarSection} className="glass">
                <h4 style={styles.sidebarTitle}>Filter by Domain</h4>
                {domains.length === 0 ? (
                  <p style={{ color: 'hsl(var(--text-subtle))', fontSize: '0.9rem' }}>No domains derived</p>
                ) : (
                  <ul style={styles.domainList}>
                    <li
                      onClick={() => setSelectedDomain(null)}
                      style={{
                        ...styles.domainItem,
                        ...(!selectedDomain ? styles.domainItemActive : {})
                      }}
                    >
                      All Domains
                    </li>
                    {domains.map(d => (
                      <li
                        key={d}
                        onClick={() => setSelectedDomain(d)}
                        style={{
                          ...styles.domainItem,
                          ...(selectedDomain === d ? styles.domainItemActive : {})
                        }}
                      >
                        {d}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
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
  },
  header: {
    padding: '1rem 2rem',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    borderBottom: '1px solid hsla(var(--border-color), 0.5)',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
  },
  logoLink: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'hsl(var(--text-main))',
    letterSpacing: '-0.05em',
  },
  logoDot: {
    color: 'hsl(var(--primary))',
  },
  searchBox: {
    flex: 1,
    maxWidth: '520px',
    position: 'relative',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'hsla(var(--bg-card), 0.5)',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: '20px',
    padding: '0.4rem 1rem',
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'hsl(var(--text-main))',
    fontSize: '1rem',
    fontFamily: 'var(--font-sans)',
  },
  clearBtn: {
    color: 'hsl(var(--text-subtle))',
    padding: '0.1rem',
  },
  suggestList: {
    position: 'absolute',
    top: '110%',
    left: 0,
    right: 0,
    listStyle: 'none',
    borderRadius: '12px',
    border: '1px solid hsl(var(--border-color))',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
    zIndex: 20,
    margin: 0,
    padding: 0,
  },
  suggestItem: {
    padding: '0.6rem 1rem',
    cursor: 'pointer',
    color: 'hsl(var(--text-main))',
    transition: 'background-color 0.15s ease',
  },
  suggestItemActive: {
    backgroundColor: 'hsla(var(--primary), 0.15)',
    color: 'hsl(var(--primary))',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  debugBtn: {
    fontSize: '0.85rem',
    fontWeight: 500,
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid hsl(var(--border-color))',
    color: 'hsl(var(--text-muted))',
  },
  debugBtnActive: {
    borderColor: 'hsl(var(--primary))',
    color: 'hsl(var(--primary))',
    boxShadow: '0 0 10px var(--primary-glow)',
  },
  statsLink: {
    fontSize: '0.85rem',
    fontWeight: 500,
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid hsl(var(--border-color))',
    color: 'hsl(var(--text-muted))',
  },
  compareLink: {
    fontSize: '0.85rem',
    fontWeight: 500,
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid hsl(var(--secondary))',
    color: 'hsl(var(--text-muted))',
  },
  mainContainer: {
    flex: 1,
    width: '100%',
    maxWidth: '1200px',
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: '2.5rem',
    alignItems: 'start',
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  metaSummary: {
    color: 'hsl(var(--text-subtle))',
    fontSize: '0.9rem',
    marginBottom: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
    flexWrap: 'wrap',
  },
  filterTag: {
    backgroundColor: 'hsla(var(--primary), 0.15)',
    color: 'hsl(var(--primary))',
    padding: '0.15rem 0.6rem',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  clearFilterBtn: {
    color: 'hsl(var(--primary))',
    fontWeight: 'bold',
  },
  card: {
    padding: '1.2rem 1.5rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  urlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    fontSize: '0.8rem',
  },
  domainBadge: {
    backgroundColor: 'hsla(var(--secondary), 0.15)',
    color: 'hsl(var(--secondary))',
    padding: '0.1rem 0.4rem',
    borderRadius: '4px',
    fontWeight: 500,
  },
  urlText: {
    color: 'hsl(var(--text-subtle))',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '350px',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'hsl(var(--secondary))',
  },
  snippet: {
    color: 'hsl(var(--text-muted))',
    fontSize: '0.95rem',
    wordBreak: 'break-word',
  },
  debugRow: {
    fontSize: '0.8rem',
    color: 'hsl(var(--text-subtle))',
    borderTop: '1px solid hsla(var(--text-subtle), 0.05)',
    paddingTop: '0.5rem',
    marginTop: '0.2rem',
  },
  sidebar: {
    position: 'sticky',
    top: '5rem',
  },
  sidebarSection: {
    padding: '1.2rem',
    borderRadius: '12px',
  },
  sidebarTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    marginBottom: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'hsl(var(--text-main))',
  },
  domainList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  domainItem: {
    padding: '0.4rem 0.6rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: 'hsl(var(--text-muted))',
    transition: 'all 0.15s ease',
  },
  domainItemActive: {
    backgroundColor: 'hsla(var(--secondary), 0.15)',
    color: 'hsl(var(--secondary))',
    fontWeight: 500,
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: '1.5rem',
    marginBottom: '2rem',
  },
  pageBtn: {
    padding: '0.5rem 1rem',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: '8px',
    color: 'hsl(var(--text-muted))',
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  pageBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  pageNumberBtn: {
    padding: '0.5rem 0.8rem',
    border: '1px solid transparent',
    borderRadius: '8px',
    color: 'hsl(var(--text-muted))',
    fontSize: '0.9rem',
  },
  pageNumberBtnActive: {
    borderColor: 'hsl(var(--primary))',
    backgroundColor: 'hsla(var(--primary), 0.1)',
    color: 'hsl(var(--primary))',
  },
  errorContainer: {
    padding: '2rem',
    borderRadius: '12px',
    textAlign: 'center',
    color: 'hsl(var(--error))',
  },
  errorIcon: {
    fontSize: '2rem',
    display: 'block',
    marginBottom: '0.5rem',
  },
  emptyContainer: {
    padding: '3rem 2rem',
    borderRadius: '12px',
    textAlign: 'center',
  },
  skeletonContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  skeletonCard: {
    padding: '1.5rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
  },
  skeletonTitle: {
    height: '20px',
    backgroundColor: 'hsla(var(--text-subtle), 0.1)',
    width: '40%',
    borderRadius: '4px',
  },
  skeletonSnippet: {
    height: '14px',
    backgroundColor: 'hsla(var(--text-subtle), 0.07)',
    width: '85%',
    borderRadius: '4px',
  },
  skeletonSnippetShort: {
    height: '14px',
    backgroundColor: 'hsla(var(--text-subtle), 0.07)',
    width: '60%',
    borderRadius: '4px',
  },
};

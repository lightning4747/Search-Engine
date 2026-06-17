import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../api/client';

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch suggestions with a debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const handler = setTimeout(() => {
      apiClient.suggest(query.trim())
        .then(res => setSuggestions(res))
        .catch(() => {});
    }, 200); // 200ms debounce

    return () => clearTimeout(handler);
  }, [query]);

  // Click outside listener to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
      : query;
    if (targetQuery.trim()) {
      navigate(`/results?q=${encodeURIComponent(targetQuery.trim())}`);
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

  const selectSuggestion = (term: string) => {
    setQuery(term);
    setShowSuggestions(false);
    navigate(`/results?q=${encodeURIComponent(term)}`);
  };

  return (
    <div style={styles.page}>
      {/* Top Navigation */}
      <nav style={styles.nav}>
        <Link to="/compare" style={styles.compareLink}>⚡ Compare</Link>
        <Link to="/stats" style={styles.navLink}>Stats & Admin</Link>
      </nav>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.logoContainer}>
          <h1 style={styles.logoText}>
            Lightning <span style={styles.logoDot}>Engine</span>
          </h1>
          <p style={styles.logoSubText}>Instant Positional Indexing Engine</p>
        </div>

        {/* Search Input Container */}
        <div ref={containerRef} style={styles.searchBoxContainer}>
          <form onSubmit={handleSearchSubmit} style={styles.form}>
            <div style={{ ...styles.inputWrapper, ...(showSuggestions && suggestions.length > 0 ? styles.inputWrapperActive : {}) }}>
              <span style={styles.searchIcon}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg></span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                  setActiveIndex(-1);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search index..."
                style={styles.input}
                role="combobox"
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-controls="suggestion-list"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSuggestions([]);
                    inputRef.current?.focus();
                  }}
                  style={styles.clearButton}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Suggestions listbox */}
            {showSuggestions && suggestions.length > 0 && (
              <ul id="suggestion-list" role="listbox" style={styles.suggestionsList} className="glass">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(suggestion);
                    }}
                    style={{
                      ...styles.suggestionItem,
                      ...(index === activeIndex ? styles.suggestionItemActive : {})
                    }}
                  >
                    <span style={styles.suggestSearchIcon}></span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
  },
  nav: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    padding: '1.5rem 2rem',
  },
  navLink: {
    color: 'hsl(var(--text-muted))',
    fontWeight: 500,
    fontSize: '0.95rem',
    border: '1px solid hsl(var(--border-color))',
    padding: '0.4rem 1rem',
    borderRadius: '8px',
    transition: 'all 0.15s ease',
  },
  compareLink: {
    color: 'hsl(var(--text-muted))',
    fontWeight: 500,
    fontSize: '0.95rem',
    border: '1px solid hsl(var(--secondary))',
    padding: '0.4rem 1rem',
    borderRadius: '8px',
    transition: 'all 0.15s ease',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1.5rem 6rem 1.5rem',
    zIndex: 1,
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '2.5rem',
  },
  logoText: {
    fontSize: '3rem',
    fontWeight: 700,
    letterSpacing: '-0.05em',
    color: 'hsl(var(--text-main))',
  },
  logoDot: {
    color: 'hsl(var(--primary))',
    fontWeight: 300,
    marginLeft: '0.1rem',
  },
  logoSubText: {
    color: 'hsl(var(--text-muted))',
    marginTop: '0.5rem',
    fontSize: '1rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  searchBoxContainer: {
    width: '100%',
    maxWidth: '580px',
    position: 'relative',
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'hsla(var(--bg-card), 0.6)',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: '24px',
    padding: '0.6rem 1.2rem',
    transition: 'all 0.2s ease',
  },
  inputWrapperActive: {
    borderBottomLeftRadius: '0px',
    borderBottomRightRadius: '0px',
    borderColor: 'hsl(var(--primary))',
  },
  searchIcon: {
    marginRight: '0.8rem',
    color: 'hsl(var(--text-subtle))',
    fontSize: '1.1rem',
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
  clearButton: {
    color: 'hsl(var(--text-subtle))',
    fontSize: '0.9rem',
    padding: '0.2rem',
  },
  suggestionsList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    listStyle: 'none',
    borderTop: 'none',
    borderBottomLeftRadius: '16px',
    borderBottomRightRadius: '16px',
    border: '1px solid hsl(var(--border-color))',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
    zIndex: 10,
    margin: 0,
    padding: 0,
  },
  suggestionItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem 1.2rem',
    color: 'hsl(var(--text-main))',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'background-color 0.15s ease',
  },
  suggestionItemActive: {
    backgroundColor: 'hsla(var(--primary), 0.15)',
    color: 'hsl(var(--primary))',
  },
  suggestSearchIcon: {
    marginRight: '0.8rem',
    fontSize: '0.9rem',
    opacity: 0.6,
  },
  footer: {
    textAlign: 'center',
    padding: '1.5rem',
    color: 'hsl(var(--text-subtle))',
    fontSize: '0.9rem',
    borderTop: '1px solid hsla(var(--text-subtle), 0.05)',
  },
};

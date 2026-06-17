import React from 'react';
import { type SearchResult } from '../api/client';

interface CompareResultCardProps {
  result: SearchResult;
  rank: number;
}

export default function CompareResultCard({ result, rank }: CompareResultCardProps) {
  return (
    <article style={styles.card} className="glass animate-fade-in">
      <header style={styles.cardHeader}>
        <div style={styles.urlRow}>
          <span style={styles.rankBadge}>#{rank}</span>
          <span style={styles.domainBadge}>{result.domain}</span>
          <span style={styles.urlText}>{result.url}</span>
        </div>
        <a href={result.url} target="_blank" rel="noopener noreferrer" style={styles.cardTitle}>
          {result.title || 'Untitled Page'}
        </a>
      </header>
      <p style={styles.snippet}>
        {result.snippet}
      </p>
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: '0.9rem 1.1rem',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    width: '100%',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  urlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
  },
  rankBadge: {
    backgroundColor: 'hsla(var(--primary), 0.2)',
    color: 'hsl(var(--primary))',
    padding: '0.05rem 0.35rem',
    borderRadius: '4px',
    fontWeight: 600,
  },
  domainBadge: {
    backgroundColor: 'hsla(var(--secondary), 0.15)',
    color: 'hsl(var(--secondary))',
    padding: '0.05rem 0.35rem',
    borderRadius: '4px',
    fontWeight: 500,
  },
  urlText: {
    color: 'hsl(var(--text-subtle))',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '220px',
  },
  cardTitle: {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: 'hsl(var(--secondary))',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
  snippet: {
    color: 'hsl(var(--text-muted))',
    fontSize: '0.85rem',
    wordBreak: 'break-word',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
};

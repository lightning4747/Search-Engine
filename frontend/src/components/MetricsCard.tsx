import React from 'react';

interface MetricsCardProps {
  engine: 'lightning' | 'elasticsearch';
  tookMs: number | null;
  totalHits: number | null;
  isWinner: boolean;
  loading: boolean;
}

export default function MetricsCard({
  engine,
  tookMs,
  totalHits,
  isWinner,
  loading
}: MetricsCardProps) {
  const isLightning = engine === 'lightning';
  const displayName = isLightning ? 'Lightning Engine' : 'Elasticsearch';
  const emoji = isLightning ? '' : '';

  if (loading) {
    return (
      <div style={styles.card} className="glass">
        <div style={styles.skeletonTitle}></div>
        <div style={styles.skeletonRow}></div>
        <div style={styles.skeletonRow}></div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.card, ...(isWinner ? styles.winnerCard : {}) }} className="glass animate-fade-in">
      <div style={styles.header}>
        <h3 style={styles.title}>
          <span style={styles.emoji}>{emoji}</span> {displayName}
        </h3>
        {isWinner && (
          <span style={styles.winnerBadge}>
            🏆 Faster
          </span>
        )}
      </div>

      <div style={styles.body}>
        <div style={styles.row}>
          <span style={styles.label}>Query Time:</span>
          <span style={styles.value}>
            {tookMs !== null ? `${tookMs.toFixed(2)} ms` : '--'}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Total Hits:</span>
          <span style={styles.value}>
            {totalHits !== null ? totalHits.toLocaleString() : '--'}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>Results Shown:</span>
          <span style={styles.value}>10</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: '1.25rem',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    position: 'relative',
    transition: 'all 0.3s ease',
  },
  winnerCard: {
    borderColor: 'hsl(var(--secondary))',
    boxShadow: '0 0 15px hsla(0, 0%, 100%, 0.05)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '1.15rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  emoji: {
    fontSize: '1.2rem',
  },
  winnerBadge: {
    backgroundColor: 'hsla(0, 0%, 100%, 0.1)',
    color: 'hsl(var(--text-main))',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.25rem 0.6rem',
    borderRadius: '12px',
    border: '1px solid hsla(0, 0%, 100%, 0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
  },
  label: {
    color: 'hsl(var(--text-muted))',
  },
  value: {
    color: 'hsl(var(--text-main))',
    fontWeight: 500,
  },
  skeletonTitle: {
    height: '24px',
    backgroundColor: 'hsla(var(--text-subtle), 0.15)',
    borderRadius: '4px',
    width: '60%',
  },
  skeletonRow: {
    height: '16px',
    backgroundColor: 'hsla(var(--text-subtle), 0.1)',
    borderRadius: '4px',
    width: '100%',
  }
};

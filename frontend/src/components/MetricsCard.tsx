import React from 'react';

interface MetricsCardProps {
  engine: 'lightning' | 'elasticsearch';
  tookMs: number | null;
  totalHits: number | null;
  isWinner: boolean; // Speed winner
  isAccuracyWinner: boolean; // Accuracy winner
  loading: boolean;
  precisionAtK?: number | null;
  recallAtK?: number | null;
  ndcgAtK?: number | null;
}

export default function MetricsCard({
  engine,
  tookMs,
  totalHits,
  isWinner,
  isAccuracyWinner,
  loading,
  precisionAtK,
  recallAtK,
  ndcgAtK
}: MetricsCardProps) {
  const isLightning = engine === 'lightning';
  const displayName = isLightning ? 'Lightning Engine' : 'Elasticsearch';

  if (loading) {
    return (
      <div style={styles.card} className="glass">
        <div style={styles.skeletonTitle}></div>
        <div style={styles.skeletonRow}></div>
        <div style={styles.skeletonRow}></div>
        <div style={styles.skeletonRow}></div>
      </div>
    );
  }

  const hasAccuracy = ndcgAtK !== undefined && ndcgAtK !== null;

  return (
    <div style={{ ...styles.card, ...((isWinner || isAccuracyWinner) ? styles.winnerCard : {}) }} className="glass animate-fade-in">
      <div style={styles.header}>
        <h3 style={styles.title}>
          {displayName}
        </h3>
        <div style={styles.badgeContainer}>
          {isWinner && (
            <span style={styles.winnerBadge}>
              Faster
            </span>
          )}
          {isAccuracyWinner && (
            <span style={styles.accuracyBadge}>
              Better Accuracy
            </span>
          )}
        </div>
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

        {hasAccuracy && (
          <>
            <div style={styles.divider}></div>
            <div style={styles.row}>
              <span style={styles.label}>NDCG@10 (Relevance):</span>
              <span style={{ ...styles.value, color: isAccuracyWinner ? 'hsl(var(--primary))' : 'hsl(var(--text-main))' }}>
                {ndcgAtK.toFixed(4)}
              </span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Precision@10:</span>
              <span style={styles.value}>
                {precisionAtK !== undefined && precisionAtK !== null ? precisionAtK.toFixed(4) : '--'}
              </span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Recall@10:</span>
              <span style={styles.value}>
                {recallAtK !== undefined && recallAtK !== null ? recallAtK.toFixed(4) : '--'}
              </span>
            </div>
          </>
        )}
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
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '1.15rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  badgeContainer: {
    display: 'flex',
    gap: '0.4rem',
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
  accuracyBadge: {
    backgroundColor: 'hsla(var(--primary), 0.15)',
    color: 'hsl(var(--text-main))',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.25rem 0.6rem',
    borderRadius: '12px',
    border: '1px solid hsla(var(--primary), 0.25)',
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
  divider: {
    height: '1px',
    backgroundColor: 'hsla(var(--border-color), 0.5)',
    margin: '0.5rem 0',
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

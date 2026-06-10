import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, type StatsResponse } from '../api/client';

export default function StatsDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = () => {
    setLoading(true);
    apiClient.getStats()
      .then(res => {
        setStats(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'Failed to fetch index statistics.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStats();
  }, []);



  return (
    <div style={styles.page}>
      <header style={styles.header} className="glass">
        <button onClick={() => navigate('/')} style={styles.backBtn}>
          ← Back to Search
        </button>
        <span style={styles.headerTitle}>System Stats & Control Center</span>
      </header>

      <main style={styles.main} className="container animate-fade-in">
        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p>Fetching index stats...</p>
          </div>
        ) : error ? (
          <div style={styles.errorContainer} className="glass">
            <h3>Error</h3>
            <p style={{ marginTop: '0.5rem' }}>{error}</p>
            <button onClick={fetchStats} style={styles.retryBtn}>Retry</button>
          </div>
        ) : stats ? (
          <div style={styles.grid}>
            {/* Stats Dashboard Grid */}
            <div style={styles.statsCard} className="glass">
              <span style={styles.statsLabel}>Total Documents Indexed</span>
              <span style={styles.statsValue}>{stats.doc_count}</span>
            </div>


            <div style={styles.statsCard} className="glass">
              <span style={styles.statsLabel}>Total Term Vocabulary Size</span>
              <span style={styles.statsValue}>{stats.total_terms}</span>
            </div>

            <div style={styles.statsCard} className="glass">
              <span style={styles.statsLabel}>Last Indexed At</span>
              <span style={{
                ...styles.statsValue,
                fontSize: stats.last_indexed_at ? '1.1rem' : '1.8rem',
                fontWeight: stats.last_indexed_at ? 500 : 700
              }}>
                {stats.last_indexed_at ? new Date(stats.last_indexed_at).toLocaleString() : 'Never'}
              </span>
            </div>

          </div>
        ) : null}
      </main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '1rem 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
    borderBottom: '1px solid hsla(var(--border-color), 0.5)',
  },
  backBtn: {
    color: 'hsl(var(--text-muted))',
    fontWeight: 500,
    border: '1px solid hsl(var(--border-color))',
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
  },
  headerTitle: {
    fontWeight: 600,
    fontSize: '1.1rem',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '900px',
  },
  loadingContainer: {
    textAlign: 'center',
    padding: '4rem 2rem',
    color: 'hsl(var(--text-muted))',
  },
  spinner: {
    border: '3px solid hsla(var(--text-subtle), 0.1)',
    borderTop: '3px solid hsl(var(--primary))',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 1.5rem auto',
  },
  errorContainer: {
    padding: '2rem',
    borderRadius: '12px',
    color: 'hsl(var(--error))',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: '1rem',
    padding: '0.4rem 1rem',
    backgroundColor: 'hsl(var(--error))',
    color: '#fff',
    borderRadius: '6px',
    fontWeight: 500,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1.5rem',
  },
  statsCard: {
    padding: '1.5rem',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  statsLabel: {
    fontSize: '0.85rem',
    color: 'hsl(var(--text-subtle))',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statsValue: {
    fontSize: '2rem',
    fontWeight: 700,
    color: 'hsl(var(--secondary))',
  },

};

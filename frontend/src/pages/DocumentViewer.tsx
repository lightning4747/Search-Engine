import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient, type DocResponse } from '../api/client';

export default function DocumentViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<DocResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient.getDocument(id)
      .then(res => {
        setDoc(res);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'Failed to fetch document metadata.');
        setLoading(false);
      });
  }, [id]);

  return (
    <div style={styles.page}>
      <header style={styles.header} className="glass">
        <button onClick={() => navigate(-1)} style={styles.backBtn}>
          ← Go Back
        </button>
        <span style={styles.headerTitle}>Document Metadata Viewer</span>
      </header>

      <main style={styles.main} className="container animate-fade-in">
        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p>Loading document metadata...</p>
          </div>
        ) : error ? (
          <div style={styles.errorContainer} className="glass">
            <h3>Error</h3>
            <p style={{ marginTop: '0.5rem' }}>{error}</p>
          </div>
        ) : doc ? (
          <div style={styles.card} className="glass">
            <h2 style={styles.title}>{doc.title || 'Untitled Document'}</h2>
            
            <div style={styles.row}>
              <span style={styles.label}>URL:</span>
              <a href={doc.url} target="_blank" rel="noopener noreferrer" style={styles.valueLink}>
                {doc.url}
              </a>
            </div>

            <div style={styles.row}>
              <span style={styles.label}>Domain:</span>
              <span style={styles.value}>{doc.domain}</span>
            </div>

            {doc.description && (
              <div style={styles.row}>
                <span style={styles.label}>Description:</span>
                <span style={styles.value}>{doc.description}</span>
              </div>
            )}

            <div style={styles.divider}></div>

            <div style={styles.grid}>
              <div style={styles.statsCard}>
                <span style={styles.statsLabel}>Word Count</span>
                <span style={styles.statsValue}>{doc.word_count ?? 'N/A'}</span>
              </div>

              <div style={styles.statsCard}>
                <span style={styles.statsLabel}>Token Length</span>
                <span style={styles.statsValue}>{doc.doc_length ?? 'N/A'}</span>
              </div>
            </div>

            <div style={styles.divider}></div>

            <div style={styles.row}>
              <span style={styles.label}>Crawled At:</span>
              <span style={styles.value}>
                {doc.crawled_at ? new Date(doc.crawled_at).toLocaleString() : 'N/A'}
              </span>
            </div>

            <div style={styles.row}>
              <span style={styles.label}>Indexed At:</span>
              <span style={styles.value}>
                {doc.indexed_at ? new Date(doc.indexed_at).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        ) : null}
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
    maxWidth: '800px',
    width: '100%',
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
  card: {
    padding: '2rem',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'hsl(var(--text-main))',
    marginBottom: '0.5rem',
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  label: {
    color: 'hsl(var(--text-subtle))',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600,
  },
  value: {
    color: 'hsl(var(--text-main))',
    fontSize: '1rem',
  },
  valueLink: {
    fontSize: '1rem',
    wordBreak: 'break-all',
  },
  divider: {
    height: '1px',
    backgroundColor: 'hsla(var(--text-subtle), 0.1)',
    margin: '0.5rem 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
  },
  statsCard: {
    backgroundColor: 'hsla(var(--bg-card), 0.4)',
    border: '1px solid hsla(var(--text-subtle), 0.05)',
    padding: '1rem',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  statsLabel: {
    fontSize: '0.8rem',
    color: 'hsl(var(--text-subtle))',
    fontWeight: 500,
  },
  statsValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'hsl(var(--secondary))',
  },
};

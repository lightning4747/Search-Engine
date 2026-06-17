import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, type StatsResponse, type BenchmarkJobResult } from '../api/client';

export default function StatsDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Benchmark Runner state
  const [adminKey, setAdminKey] = useState('');
  const [benchStatus, setBenchStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [benchError, setBenchError] = useState<string | null>(null);
  const [benchJobId, setBenchJobId] = useState<string | null>(null);
  const [benchResults, setBenchResults] = useState<BenchmarkJobResult | null>(null);

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

    // Fetch latest benchmark run results on load
    apiClient.getBenchmarkResults()
      .then(res => {
        setBenchResults(res);
        setBenchStatus(res.status);
        if (res.status === 'running') {
          setBenchJobId(res.job_id);
        }
      })
      .catch(() => {
        // Silent catch if no run exists
      });
  }, []);

  // Polling for benchmark updates
  useEffect(() => {
    if (benchStatus !== 'running' || !benchJobId) return;

    const interval = setInterval(() => {
      apiClient.getBenchmarkResults(benchJobId)
        .then(res => {
          setBenchResults(res);
          setBenchStatus(res.status);
          if (res.status !== 'running') {
            clearInterval(interval);
          }
        })
        .catch(err => {
          console.error('Error polling benchmark results:', err);
        });
    }, 5000);

    return () => clearInterval(interval);
  }, [benchStatus, benchJobId]);

  const handleRunBenchmark = () => {
    if (!adminKey.trim()) {
      setBenchError('Admin key is required');
      return;
    }
    setBenchStatus('running');
    setBenchError(null);
    setBenchResults(null);

    apiClient.runBenchmark(adminKey.trim())
      .then(res => {
        setBenchJobId(res.job_id);
      })
      .catch(err => {
        setBenchStatus('failed');
        setBenchError(err.message || 'Failed to start benchmark run.');
      });
  };

  const renderWinnerCell = (lightningVal: number, esVal: number, lowerIsBetter: boolean) => {
    if (lightningVal === esVal) return <span style={{ color: 'hsl(var(--text-subtle))' }}>-</span>;
    const lightningWins = lowerIsBetter ? lightningVal < esVal : lightningVal > esVal;

    if (lightningWins) {
      return (
        <span style={{ color: 'hsl(var(--primary))', fontWeight: 600 }}>
           Lightning
        </span>
      );
    } else {
      return (
        <span style={{ color: 'hsl(var(--secondary))', fontWeight: 600 }}>
           ES
        </span>
      );
    }
  };

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <div style={styles.grid}>
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

            {/* Benchmark Section */}
            <div style={styles.benchmarkCard} className="glass">
              <h2 style={styles.benchmarkTitle}>Benchmark Runner</h2>
              <p style={styles.benchmarkDesc}>
                Compare Lightning Engine vs Elasticsearch under a standardized 50-query set, alternating execution orders sequentially.
              </p>

              {/* Admin key input */}
              <div style={styles.adminActionRow}>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Enter admin key..."
                  style={styles.adminInput}
                />
                <button
                  onClick={handleRunBenchmark}
                  disabled={benchStatus === 'running'}
                  style={{
                    ...styles.runBtn,
                    ...(benchStatus === 'running' ? styles.runBtnDisabled : {})
                  }}
                >
                  {benchStatus === 'running' ? 'Running Benchmark...' : 'Run Full Benchmark'}
                </button>
              </div>

              {benchError && (
                <div style={styles.benchError}>
                  Error: {benchError}
                </div>
              )}

              {/* Polling/Running Status message */}
              {benchStatus === 'running' && (
                <div style={styles.runningState}>
                  <div style={styles.miniSpinner}></div>
                  <span>Benchmark is running sequentially in the background (warmup: 3, runs: 10). This may take up to 2-3 minutes. Polling for results...</span>
                </div>
              )}

              {/* Benchmark Results */}
              {benchResults && benchResults.status === 'completed' && benchResults.lightning && benchResults.elasticsearch && (
                <div style={styles.resultsContainer} className="animate-fade-in">
                  <div style={styles.resultsHeader}>
                    <h3 style={styles.resultsTitle}>Latest Results</h3>
                    <span style={styles.resultsMeta}>
                      Job #{benchResults.job_id.substring(0, 8)} • {new Date(benchResults.created_at).toLocaleString()}
                    </span>
                  </div>

                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Metric</th>
                        <th style={styles.th}>Lightning</th>
                        <th style={styles.th}>Elasticsearch</th>
                        <th style={styles.th}>Winner</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={styles.td}>Avg Latency (ms)</td>
                        <td style={styles.td}>{benchResults.lightning.avg_ms} ms</td>
                        <td style={styles.td}>{benchResults.elasticsearch.avg_ms} ms</td>
                        <td style={styles.td}>
                          {renderWinnerCell(benchResults.lightning.avg_ms, benchResults.elasticsearch.avg_ms, true)}
                        </td>
                      </tr>
                      <tr>
                        <td style={styles.td}>P50 Latency (ms)</td>
                        <td style={styles.td}>{benchResults.lightning.p50_ms} ms</td>
                        <td style={styles.td}>{benchResults.elasticsearch.p50_ms} ms</td>
                        <td style={styles.td}>
                          {renderWinnerCell(benchResults.lightning.p50_ms, benchResults.elasticsearch.p50_ms, true)}
                        </td>
                      </tr>
                      <tr>
                        <td style={styles.td}>P95 Latency (ms)</td>
                        <td style={styles.td}>{benchResults.lightning.p95_ms} ms</td>
                        <td style={styles.td}>{benchResults.elasticsearch.p95_ms} ms</td>
                        <td style={styles.td}>
                          {renderWinnerCell(benchResults.lightning.p95_ms, benchResults.elasticsearch.p95_ms, true)}
                        </td>
                      </tr>
                      <tr>
                        <td style={styles.td}>P99 Latency (ms)</td>
                        <td style={styles.td}>{benchResults.lightning.p99_ms} ms</td>
                        <td style={styles.td}>{benchResults.elasticsearch.p99_ms} ms</td>
                        <td style={styles.td}>
                          {renderWinnerCell(benchResults.lightning.p99_ms, benchResults.elasticsearch.p99_ms, true)}
                        </td>
                      </tr>
                      <tr>
                        <td style={styles.td}>QPS (Throughput)</td>
                        <td style={styles.td}>{benchResults.lightning.qps} q/s</td>
                        <td style={styles.td}>{benchResults.elasticsearch.qps} q/s</td>
                        <td style={styles.td}>
                          {renderWinnerCell(benchResults.lightning.qps, benchResults.elasticsearch.qps, false)}
                        </td>
                      </tr>
                      <tr>
                        <td style={styles.td}>Precision@10</td>
                        <td style={styles.td}>{benchResults.lightning.precision_at_10}</td>
                        <td style={styles.td}>{benchResults.elasticsearch.precision_at_10}</td>
                        <td style={styles.td}>
                          {renderWinnerCell(benchResults.lightning.precision_at_10, benchResults.elasticsearch.precision_at_10, false)}
                        </td>
                      </tr>
                      <tr>
                        <td style={styles.td}>Recall@10</td>
                        <td style={styles.td}>{benchResults.lightning.recall_at_10}</td>
                        <td style={styles.td}>{benchResults.elasticsearch.recall_at_10}</td>
                        <td style={styles.td}>
                          {renderWinnerCell(benchResults.lightning.recall_at_10, benchResults.elasticsearch.recall_at_10, false)}
                        </td>
                      </tr>
                      <tr>
                        <td style={styles.td}>MRR</td>
                        <td style={styles.td}>{benchResults.lightning.mrr}</td>
                        <td style={styles.td}>{benchResults.elasticsearch.mrr}</td>
                        <td style={styles.td}>
                          {renderWinnerCell(benchResults.lightning.mrr, benchResults.elasticsearch.mrr, false)}
                        </td>
                      </tr>
                      <tr>
                        <td style={styles.td}>NDCG@10</td>
                        <td style={styles.td}>{benchResults.lightning.ndcg_at_10}</td>
                        <td style={styles.td}>{benchResults.elasticsearch.ndcg_at_10}</td>
                        <td style={styles.td}>
                          {renderWinnerCell(benchResults.lightning.ndcg_at_10, benchResults.elasticsearch.ndcg_at_10, false)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
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
    backgroundColor: 'hsl(var(--bg-main))',
    color: 'hsl(var(--text-main))',
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
    transition: 'all 0.15s ease',
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
  benchmarkCard: {
    padding: '2rem',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  benchmarkTitle: {
    fontSize: '1.4rem',
    fontWeight: 700,
    letterSpacing: '-0.03em',
  },
  benchmarkDesc: {
    fontSize: '0.95rem',
    color: 'hsl(var(--text-muted))',
    lineHeight: '1.5',
  },
  adminActionRow: {
    display: 'flex',
    gap: '1rem',
    width: '100%',
    maxWidth: '550px',
    marginTop: '0.5rem',
  },
  adminInput: {
    flex: 1,
    backgroundColor: 'hsla(var(--bg-card), 0.6)',
    border: '1px solid hsl(var(--border-color))',
    borderRadius: '8px',
    padding: '0.5rem 0.8rem',
    color: 'hsl(var(--text-main))',
    outline: 'none',
  },
  runBtn: {
    backgroundColor: 'hsl(var(--primary))',
    color: 'hsl(var(--bg-main))',
    fontWeight: 600,
    padding: '0.5rem 1.2rem',
    borderRadius: '8px',
    fontSize: '0.9rem',
    transition: 'all 0.15s ease',
  },
  runBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  benchError: {
    color: 'hsl(var(--error))',
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  runningState: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    backgroundColor: 'hsla(var(--primary), 0.05)',
    border: '1px solid hsla(var(--primary), 0.1)',
    borderRadius: '8px',
    padding: '0.8rem 1.2rem',
    fontSize: '0.9rem',
    color: 'hsl(var(--text-muted))',
    lineHeight: '1.4',
  },
  miniSpinner: {
    border: '2px solid hsla(var(--text-subtle), 0.1)',
    borderTop: '2px solid hsl(var(--primary))',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    animation: 'spin 1s linear infinite',
    flexShrink: 0,
  },
  resultsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginTop: '1rem',
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
  },
  resultsMeta: {
    fontSize: '0.8rem',
    color: 'hsl(var(--text-subtle))',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid hsl(var(--border-color))',
    color: 'hsl(var(--text-subtle))',
    fontWeight: 600,
    textTransform: 'uppercase',
    fontSize: '0.75rem',
    letterSpacing: '0.05em',
  },
  td: {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid hsla(var(--border-color), 0.5)',
    color: 'hsl(var(--text-muted))',
  }
};

import { describe, it, expect } from 'vitest';
import { indexDocument } from '../indexDocument.js';
import { CrawledPage } from '../loader.js';

describe('Document Indexer Module', () => {
  it('should correctly index title, headings, and body text', () => {
    // Override threshold for this test
    process.env.THIN_CONTENT_THRESHOLD = '5';

    const page: CrawledPage = {
      id: 123,
      url_id: 456,
      url: 'http://test.com',
      title: 'Search Engine Project',
      description: 'Test description',
      canonical_url: 'http://test.com',
      headings: {
        h1: ['Introduction to Indexing'],
        h2: ['Step 1', 'Step 2'],
        h3: []
      },
      text_content: 'The quick brown fox jumps over the lazy dog.',
      crawled_at: new Date(),
      doc_length: 6,
      word_count: 9, // Passing (9 > 5)
      is_active: true,
      indexed_at: null,
    };

    const docIndex = indexDocument(page);

    expect(docIndex.docId).toBe(123);

    // Verify Title terms: 'search', 'engin', 'project' (stemmed)
    // 'search' should have tf_title = 1
    const searchInfo = docIndex.terms.get('search');
    expect(searchInfo).toBeDefined();
    expect(searchInfo?.tf_title).toBe(1);
    expect(searchInfo?.tf_heading).toBe(0);
    expect(searchInfo?.tf_body).toBe(0);
    expect(searchInfo?.positions).toEqual([]);

    // Verify Heading terms: 'introduction', 'indexing', 'step'
    // 'step' appears twice in h2, so tf_heading = 2
    const stepInfo = docIndex.terms.get('step');
    expect(stepInfo).toBeDefined();
    expect(stepInfo?.tf_title).toBe(0);
    expect(stepInfo?.tf_heading).toBe(2);
    expect(stepInfo?.tf_body).toBe(0);

    // Verify Body terms: 'quick', 'brown', 'fox', 'jump', 'lazi', 'dog'
    // 'quick' has tf_body = 1, positions = [0]
    const quickInfo = docIndex.terms.get('quick');
    expect(quickInfo).toBeDefined();
    expect(quickInfo?.tf_body).toBe(1);
    expect(quickInfo?.positions).toEqual([0]);

    const brownInfo = docIndex.terms.get('brown');
    expect(brownInfo?.positions).toEqual([1]);

    const dogInfo = docIndex.terms.get('dog');
    expect(dogInfo?.positions).toEqual([5]);
  });

  it('should handle pages with null title, empty headings, and null text content', () => {
    process.env.THIN_CONTENT_THRESHOLD = '0'; // Avoid filtering

    const page: CrawledPage = {
      id: 124,
      url_id: 457,
      url: 'http://test2.com',
      title: null,
      description: null,
      canonical_url: null,
      headings: null,
      text_content: null,
      crawled_at: new Date(),
      doc_length: 0,
      word_count: 0,
      is_active: true,
      indexed_at: null,
    };

    const docIndex = indexDocument(page);
    expect(docIndex.docId).toBe(124);
    expect(docIndex.terms.size).toBe(0);
  });

  it('should skip indexing thin documents (word_count < threshold)', () => {
    process.env.THIN_CONTENT_THRESHOLD = '50';

    const page: CrawledPage = {
      id: 125,
      url_id: 458,
      url: 'http://thin.com',
      title: 'Thin Page',
      description: 'Thin Description',
      canonical_url: null,
      headings: null,
      text_content: 'This page is very short.',
      crawled_at: new Date(),
      doc_length: 5,
      word_count: 5, // Failing (5 < 50)
      is_active: true,
      indexed_at: null,
    };

    const docIndex = indexDocument(page);
    expect(docIndex.docId).toBe(125);
    expect(docIndex.terms.size).toBe(0); // Index skipped, terms map empty
  });
});

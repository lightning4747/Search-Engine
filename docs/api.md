# REST API Specification

The `search-api` service provides HTTP endpoints for searching, querying stats, fetching document metadata, and triggering background indexing runs.

## 1. Search Endpoint
Queries the inverted index using search query strings.

* **URL**: `/search`
* **Method**: `GET`
* **Query Parameters**:
  * `q` (string, required): The search query.
  * `page` (integer, optional): Page offset (default: `1`).
  * `limit` (integer, optional): Results per page (default: `10`, max: `100`).

### Example Request
```bash
curl "http://localhost:3000/search?q=express+api&page=1&limit=2"
```

### Example Response (200 OK)
```json
{
  "query": "express api",
  "total_hits": 1,
  "page": 1,
  "results": [
    {
      "id": "1024",
      "url": "https://expressjs.com",
      "title": "Express - Node.js web application framework",
      "snippet": "Express is a minimal and flexible Node.js web application <mark>framework</mark> providing a robust set of features...",
      "score": 3.42591,
      "domain": "expressjs.com",
      "crawled_at": "2026-06-09T12:00:00.000Z"
    }
  ],
  "did_you_mean": null,
  "took_ms": 4.12
}
```

---

## 2. Autocomplete Suggestions Endpoint
Fetches instant suggestions matching a prefix.

* **URL**: `/suggest`
* **Method**: `GET`
* **Query Parameters**:
  * `q` (string, required): Suffix/prefix search term.

### Example Request
```bash
curl "http://localhost:3000/suggest?q=react"
```

### Example Response (200 OK)
```json
{
  "suggestions": ["react", "reactive", "reactivity"]
}
```

---

## 3. System Stats Endpoint
Returns statistics for the search index.

* **URL**: `/stats`
* **Method**: `GET`

### Example Request
```bash
curl "http://localhost:3000/stats"
```

### Example Response (200 OK)
```json
{
  "doc_count": 499,
  "avg_doc_length": 142.6,
  "last_indexed_at": "2026-06-10T13:39:27.473Z",
  "total_terms": 23742
}
```

---

## 4. Document Metadata Endpoint
Returns detailed crawl metadata for a specific document ID.

* **URL**: `/document/:id`
* **Method**: `GET`

### Example Request
```bash
curl "http://localhost:3000/document/1024"
```

### Example Response (200 OK)
```json
{
  "id": "1024",
  "url": "https://expressjs.com",
  "title": "Express - Node.js web application framework",
  "description": "Fast, unopinionated, minimalist web framework for Node.js",
  "domain": "expressjs.com",
  "crawled_at": "2026-06-09T12:00:00.000Z",
  "indexed_at": "2026-06-10T13:39:27.473Z",
  "word_count": 254,
  "doc_length": 185
}
```

---

## 5. Error Responses
* **400 Bad Request**: Returned for invalid or missing parameters (e.g. missing query `q`).
  ```json
  { "error": "Missing or empty query parameter \"q\"" }
  ```
* **404 Not Found**: Returned when fetching nonexistent document IDs.
  ```json
  { "error": "Document not found" }
  ```
* **500 Internal Server Error**: Opaque error code for unhandled exceptions.
  ```json
  { "error": "Internal server error" }
  ```

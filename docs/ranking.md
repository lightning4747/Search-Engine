# BM25 Ranking & Authority Scoring

Lightning Search Engine combines BM25 content relevance scores with field-specific boosts, PageRank-Lite link authority, and document recency multipliers to produce the final document rank.

## 1. BM25 Scorer
The base relevance score for term $t$ in document $D$ is calculated using the standard Okapi BM25 formula:

$$\text{score}_{\text{BM25}}(D, t) = \text{IDF}(t) \cdot \frac{f(t, D) \cdot (k_1 + 1)}{f(t, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$

Where:
* $f(t, D)$ is the term frequency of $t$ in document $D$.
* $|D|$ is the document length (token count).
* $\text{avgdl}$ is the average document length across the entire index corpus.
* $k_1$ (default `1.5`) controls term frequency saturation.
* $b$ (default `0.75`) regulates document length normalization.

### Inverse Document Frequency (IDF)
$$\text{IDF}(t) = \ln\left(1 + \frac{N - n(t) + 0.5}{n(t) + 0.5}\right)$$
Where:
* $N$ is the total document count in the index.
* $n(t)$ is the number of documents containing term $t$.
* If $\text{IDF}(t)$ falls below $0$, it is capped at $0$ to prevent negative relevance scores.

---

## 2. Field-Weighted Scoring
Matches in different HTML document fields carry different weights:
* **Title matches**: Multiplied by `3.0`.
* **Heading matches**: Multiplied by `1.8`.
* **Body text matches**: Multiplied by `1.0`.

The final text relevance score is the sum of these field-weighted BM25 values across all matching query terms.

---

## 3. PageRank Authority Integration
An offline link graph analyzer parses outlink references to compute iterative PageRank values for each crawled page. These authority scores are normalized to the range $[0, 1]$ and incorporated into the final relevance score using the formula:

$$\text{final\_score} = \text{score}_{\text{text}} \cdot (1 + \alpha \cdot \text{score}_{\text{authority}})$$

Where:
* $\alpha$ (default `0.2`) governs the relative influence of the link authority graph.
* If a document has no inbound links or PageRank calculated, the authority score falls back to `0.0`, resulting in no boost penalty.

---

## 4. Recency & Synonym Boosts
* **Recency Boost**: Documents tagged in the `'hot'` segment (crawled within 30 days) receive a `1.1` multiplier boost.
* **Synonym Expansion**: Extended query terms derived from synonyms are scored with a discounted boost multiplier (default `0.5`) compared to exact term matches.

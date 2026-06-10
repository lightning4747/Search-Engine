# Query Language & Parser Specification

Lightning Search Engine parses user input strings into structured Retrieval Plans to support complex search logic.

## 1. Supported Query Syntax

| Syntax | Operator Name | Description | Example |
| :--- | :--- | :--- | :--- |
| `term` | **Keyword** | Match documents containing the term or its synonyms. | `typescript` |
| `"term1 term2"` | **Exact Phrase** | Match documents where terms appear in consecutive sequence. | `"react hooks"` |
| `"term1 term2" ~N` | **Proximity Search** | Match documents where terms are within distance $N$ of each other. | `"express api" ~5` |
| `-term` | **Exclusion** | Filter out documents containing the excluded term. | `web -javascript` |

---

## 2. Grammar (EBNF)

```ebnf
Query         ::= Clause { Space Clause } ;
Clause        ::= Exclusion | PhraseProximity | Keyword ;
Exclusion     ::= "-" Keyword ;
PhraseProximity ::= QuotedString [ "~" Integer ] ;
QuotedString  ::= '"' { Character } '"' ;
Keyword       ::= Word ;
```

---

## 3. Retrieval Plan Output

The query parser transforms the user input string into a structured `RetrievalPlan` JSON object used by the retrieval engine:

```json
{
  "must": ["typescript", "search"],
  "phrase": [
    {
      "terms": ["react", "hooks"]
    }
  ],
  "proximity": [
    {
      "terms": ["express", "api"],
      "distance": 5
    }
  ],
  "exclude": ["javascript"]
}
```

### Retrieval Verification Steps:
1. **Keyword retrieval**: Fetch postings matching all `must` terms and synonym terms.
2. **Exclusion filtering**: Drop any document IDs that appear in postings for `exclude` terms.
3. **Phrase validation**: Intersect position lists of consecutive terms to verify phrase order.
4. **Proximity check**: Evaluate position indices to confirm terms are within the $N$-word proximity threshold.

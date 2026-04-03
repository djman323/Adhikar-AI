# Adhikar AI – Algorithms Cheatsheet

## Quick Reference for Data Processing Pipeline

### 🔄 Data Pipeline Overview
```
PDF File
   ↓
[PyPDFLoader]  ← Extract text + metadata
   ↓
[RecursiveCharacterTextSplitter]  ← Parent chunks (2200 chars) + Child chunks (700 chars)
   ↓
[HuggingFace Embeddings]  ← all-MiniLM-L6-v2 (384-dim vectors)
   ↓
[FAISS] + [BM25]  ← Dual indexing (semantic + keyword)
```

---

## 12 Algorithms at a Glance

| # | Algorithm | Input | Output | Key Parameter |
|---|-----------|-------|--------|---|
| 1 | **PyPDFLoader** | PDF file | Text pages + metadata | Page boundaries |
| 2 | **RecursiveCharacterTextSplitter** | Long pages | Parent/Child chunks | Parent: 2200/220, Child: 700/100 |
| 3 | **Sentence-Transformers** | Text chunks | Dense vectors | Model: all-MiniLM-L6-v2, Dim: 384 |
| 4 | **FAISS** | Embeddings | Indexed vectors | IndexFlatL2 (cosine distance) |
| 5 | **Dense Search** | Query embedding | Top-k similar chunks | k=12 (default) |
| 6 | **BM25 Okapi** | Tokenized query | Keyword scores | Per-chunk relevance |
| 7 | **Reciprocal Rank Fusion** | Dense + BM25 ranks | Combined score | Formula: 1/(60+rank) for each |
| 8 | **Cross-Encoder** | (Query, Chunk) pairs | Relevance score 0-1 | Model: ms-marco-MiniLM-L-6-v2 |
| 9 | **Regex Patterns** | Text | Section hints | Article/Part/Schedule detection |
| 10 | **Parent Mapper** | Child chunks | Parent context | Up to 4 parents per child |
| 11 | **Prompt Assembly** | Components | Final prompt | Memory: last 8 turns, max tokens: 512 |
| 12 | **Qwen LLM** | Assembled prompt | Legal answer | Model: qwen2.5:7b, Temp: 0.0 |

---

## Phase Breakdown

### Phase 1️⃣ Indexing Time (Offline)
- **PyPDFLoader**: Load Constitution PDF, preserve page numbers
- **RecursiveCharacterTextSplitter**: Create parent (broad context) + child (high precision) chunks
- **Embeddings**: Convert all chunks to semantic vectors
- **FAISS**: Store indexes for fast retrieval
- **BM25**: Build keyword scoring matrix

### Phase 2️⃣ Query Time (Online)
- **Tokenize**: Break user question into words
- **Dense Search**: Find semantically similar chunks via FAISS
- **BM25 Search**: Find keyword-matching chunks
- **RRF Merge**: Combine both rankings (prevents over-reliance on one signal)
- **Cross-Encoder Rerank**: Final quality ranking of top candidates
- **Parent Mapping**: Expand child chunks with parent context
- **Prompt Assembly**: Build final input for LLM
- **Qwen Generation**: Produce natural language legal answer

---

## Key Formulas

### Reciprocal Rank Fusion
```
combined_score = 1/(60 + dense_rank) + 1/(60 + bm25_rank)
```
Why 60? Acts as a "smoothing" constant to prevent over-penalizing items ranked slightly lower. Ensures items ranked #1 in either method get meaningful scores.

### Cross-Encoder Scoring
```
relevance_score ∈ [0, 1]  (trained on MS MARCO legal corpus)
high_score = Query + Chunk are highly relevant
low_score = Query + Chunk are weakly related
```

### BM25 Formula (Simplified)
```
score = IDF(term) * (TF(term) * (k1 + 1)) / (TF(term) + k1 * (1 - b + b * (doc_len / avg_doc_len)))
```
Captures: term frequency, inverse document frequency, document length normalization.

---

## Why This Combination Works for Constitutional Law

✅ **Dense Search**: Catches semantic variations ("right to life" ↔ "Article 21")  
✅ **BM25**: Preserves exact legal terms ("Article 32", "habeas corpus")  
✅ **RRF Fusion**: Hybrid approach avoids single-method bias  
✅ **Cross-Encoder**: Fine-tuned on legal/passage ranking, beats generic similarity  
✅ **Parent Context**: Maintains broader legal principles alongside precise passages  
✅ **Regex Detection**: Adds metadata hints for transparency  
✅ **Local LLM (Qwen)**: Deterministic, no hallucinations at temp=0.0  

---

## Performance Characteristics

| Component | Speed | Memory | Accuracy |
|-----------|-------|--------|----------|
| PyPDFLoader | Fast | Low | 100% (PDF extraction) |
| RecursiveCharacterTextSplitter | Very Fast | Low | High (rule-based chunking) |
| FAISS Dense Search | **Very Fast** (~10ms) | Medium | High (semantic) |
| BM25 Keyword Search | **Fast** (~5ms) | Low | High (exact match) |
| RRF Merging | Negligible | Negligible | High (ensemble) |
| Cross-Encoder Reranking | Moderate (~50ms) | Medium | **Highest** (fine-tuned) |
| Qwen LLM Generation | Slow (~1-3s) | High | Good (grounded) |

**Total Query Latency**: ~2-4 seconds (depends on hardware)

---

## Example Query Walkthrough

**User asks**: "What is my right if I am wrongfully detained?"

1. **PyPDFLoader** (offline): Indian Constitution already loaded
2. **RecursiveCharacterTextSplitter** (offline): 200 parent + 1000 child chunks created
3. **Embeddings** (offline): All chunks vectorized
4. **Dense Search**: Query "wrongfully detained" → FAISS finds 12 chunks near "habeas corpus", "Article 32", "Personal Liberty"
5. **BM25 Search**: Keyword search finds 12 chunks containing "detention", "writ", "Article 21"
6. **RRF Fusion**: Merges both lists → ~15 unique chunks with combined scores
7. **Cross-Encoder**: Ranks all 15 → Top 3 are about habeas corpus and emergency protections
8. **Parent Mapping**: Expands top 3 children → Pulls parent chunks for full Article 32 context
9. **Prompt Assembly**: Builds: system prompt + memory + retrieved context + question
10. **Qwen LLM** (temp=0.0): Generates deterministic answer citing Articles 21, 22, 32, mentioning habeas corpus
11. **Output**: "Your right is protected under Articles 21-22. You can file a writ of habeas corpus under Article 32..."
12. **Sources**: [Page 15 - Article 21], [Page 18 - Article 32]

---

## Tuning Parameters (If Needed)

| Component | Parameter | Current | Range | Effect |
|-----------|-----------|---------|-------|--------|
| Parent Chunking | chunk_size | 2200 | 1500-3000 | Larger = more context, fewer chunks |
| Parent Chunking | overlap | 220 | 100-400 | Larger = smoother boundaries, more chunks |
| Child Chunking | chunk_size | 700 | 300-1000 | Smaller = more precise retrieval |
| Dense Search | k | 12 | 5-20 | More candidates = higher latency |
| BM25 Search | k | 12 | 5-20 | More candidates = higher latency |
| RRF Smoothing | constant | 60 | 10-100 | Balances contribution of both rankers |
| Cross-Encoder | candidates_ratio | 3x | 2-5x | Ratio of chunks to rerank |
| LLM | temperature | 0.0 | 0.0-0.3 | 0.0 = deterministic, 0.3 = slightly varied |
| LLM | num_predict | 512 | 256-1024 | Max response length (tokens) |

---

## Further Reading

- **FAISS**: facebook.com/research/papers/faiss
- **BM25**: Okapi BM25 probabilistic retrieval model
- **Reciprocal Rank Fusion**: Cormack et al. (2009) "Reciprocal Rank Fusion outperforms Condorcet" 
- **Cross-Encoders**: Nils Reimers' Sentence-Transformers documentation
- **Qwen Models**: alibaba/qwen2.5 on Hugging Face Hub

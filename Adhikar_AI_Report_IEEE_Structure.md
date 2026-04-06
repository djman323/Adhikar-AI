# Title

# KU ID Name

# Abstract (100 words)

Adhikar AI is a constitutional legal assistant designed to provide reliable and source-grounded responses using the Indian Constitution as its primary knowledge base. The system combines document indexing, semantic retrieval, keyword retrieval, and reranking to identify the most relevant legal passages before generating an answer. A local large language model is then used to produce clear explanations with constitutional context and source references. This approach improves trust, transparency, and relevance in legal question-answering. The platform includes a modern user interface, session-aware interaction, and practical support for rights-related queries, making it useful for students, citizens, and legal researchers in India.

# Intro (500 words)

Access to constitutional understanding is often limited by legal complexity, long-form text, and lack of guided interpretation for non-expert users. Many people know they have rights, but they struggle to map real-life situations to the right constitutional provisions, legal principles, and remedies. Adhikar AI was developed to address this gap by creating a focused constitutional assistant that can explain rights in plain language while staying connected to the source document.

The core objective of the project is not to create a general chatbot, but a domain-specific legal intelligence system. The assistant is designed around one central principle: retrieval first, generation second. Instead of allowing the model to answer from generic pretraining memory alone, Adhikar AI first searches relevant passages from the Indian Constitution data and then uses those retrieved passages to generate a response. This structure improves reliability and reduces off-topic output.

The project uses a document pipeline that starts from the Constitution PDF and converts it into searchable units. The text is split into parent chunks and child chunks to balance context retention and retrieval precision. Parent chunks preserve broader legal context, while child chunks improve exact matching to user intent. The resulting chunks are vectorized using an embedding model and indexed with FAISS for semantic similarity search. In parallel, BM25 keyword retrieval is used to capture exact legal terms. These two retrieval channels are merged using reciprocal rank fusion, and then a reranker model prioritizes the strongest passages.

Once top passages are selected, the backend builds a structured prompt containing system instructions, conversation memory, user question, and retrieved constitutional context. A locally hosted Qwen model running through Ollama then generates the final answer. The response is sent back with source identifiers and page hints so that the user can understand where the explanation came from.

The system architecture includes a Python Flask backend, a retrieval engine module, and a modern Next.js frontend. The interface supports conversational querying, quick prompts, response style selection, and source viewing. This improves usability for both technical and non-technical users.

Adhikar AI contributes value in three ways. First, it improves accessibility by converting complex constitutional material into understandable responses. Second, it improves trust through source-grounded output and transparent retrieval context. Third, it supports practical legal exploration by helping users connect situations such as discrimination, wrongful detention, or rights violation to constitutional provisions and possible remedies.

In summary, this project demonstrates how a focused retrieval-augmented architecture can make constitutional legal guidance more accessible, structured, and explainable while preserving legal grounding.

# Name of Data Set

Indian Constitution PDF dataset

# Each Data Set Description

## D1: Indian Constitution Primary Corpus

- Source file: Indian Constitution.pdf
- Type: Unstructured legal text (PDF)
- Domain: Indian Constitutional Law
- Role in system: Primary legal knowledge source for retrieval and answer grounding
- Processing: Loaded page-wise, chunked into parent and child chunks, indexed for retrieval

## D2: Derived Parent Chunk Dataset

- Source: Generated from D1 during preprocessing
- Type: Structured text chunks with metadata
- Metadata fields: parent_id, page, section_hint, source
- Role in system: Provides broader constitutional context for final answer assembly

## D3: Derived Child Chunk Dataset

- Source: Generated from parent chunks
- Type: Fine-grained text chunks with metadata
- Metadata fields: child_id, parent_id, page, section_hint, source
- Role in system: Used for high-precision dense/sparse retrieval and reranking

# Model Deploy in D1 D2 D3 (Name, Description)

| Data Layer         | Model/Method Name                            | Description                                                                  |
| ------------------ | -------------------------------------------- | ---------------------------------------------------------------------------- |
| D1 (Primary PDF)   | PyPDFLoader + RecursiveCharacterTextSplitter | Loads and segments constitutional text into structured retrieval units       |
| D2 (Parent chunks) | FAISS + all-MiniLM-L6-v2 embeddings          | Stores broad semantic vectors for context-preserving retrieval               |
| D3 (Child chunks)  | FAISS + BM25 + Cross-Encoder reranker        | Performs precise retrieval, hybrid ranking, and final passage prioritization |

# Novelty - Uniqueness in Your Deployed Model

Adhikar AI is unique because it combines constitutional-domain focus with a retrieval-driven legal response pipeline and local model deployment. Unlike generic assistants, it is intentionally constrained to constitutional context and legal reasoning patterns. The novelty lies in hybrid retrieval (semantic + keyword), two-level chunking (context + precision), reranked evidence selection, and source-aware response generation. It also integrates session memory and response-style controls for practical usability. Running the LLM locally through Ollama further improves privacy and reproducibility, making it suitable for academic projects, legal education, and controlled offline environments where deterministic, document-grounded legal assistance is required.

# Human in the Loop

Human in the loop means the system is designed to support human supervision rather than replace it. In Adhikar AI, the model gives a grounded legal response, but the user remains responsible for reviewing the answer, checking the source references, and deciding whether professional legal advice is needed. This is important because constitutional and legal questions can depend on facts, context, and jurisdiction.

The human-in-the-loop idea appears in three ways. First, the system shows source/page references so the user can verify the answer. Second, the interface allows follow-up questions, which lets the user clarify facts if the first response is not enough. Third, the project is positioned as a support tool for learning and guidance, not as a final legal authority. In real use, a lawyer, teacher, or informed user can review the response before acting on it.

This approach improves safety and trust. It reduces the risk of blindly accepting AI output, especially in legal situations where wrong assumptions can create problems. By keeping the human involved in verification and final judgment, the system becomes more practical and responsible.

# Algorithms Used in Data Processing

The project uses multiple complementary algorithms to transform raw PDF text into searchable, rankable, and retrievable knowledge. These are applied in sequence during both indexing and runtime query processing.

## Phase 1: Document Loading and Chunking

### 1. PyPDFLoader (PDF Reading)

Reads the Indian Constitution PDF page by page and extracts text content while preserving metadata (page numbers, source). Input: Constitution.pdf | Output: List of page objects with text and metadata.

### 2. RecursiveCharacterTextSplitter (Hierarchical Chunking)

Splits long text into smaller chunks using recursive separators (newlines, spaces, etc.). **Parent chunking**: chunk_size=2200, overlap=220 characters (preserves broader context). **Child chunking**: chunk_size=700, overlap=100 characters (improves retrieval precision). Ensures that important legal sentences are not broken mid-article reference. Input: Long pages | Output: Parent chunks and child chunks with metadata.

## Phase 2: Vectorization and Indexing

### 3. Sentence-Transformers Embedding Model (all-MiniLM-L6-v2)

Converts each text chunk into a fixed-length numerical vector (384 dimensions) using transformer architecture to capture semantic meaning. Similar text passages get similar vectors in vector space. Input: Text chunks | Output: Dense embeddings for each chunk.

### 4. FAISS Index (Facebook AI Similarity Search)

Stores embeddings in a fast, indexable structure enabling quick similarity search using vector distance calculations. Two separate FAISS indexes are built: one for parent chunks, one for child chunks. Query time: given a user question embedding, quickly finds k most similar chunk embeddings. Input: Embeddings | Output: Indexed searchable knowledge base.

## Phase 3: Runtime Retrieval (Query Processing)

### 5. Dense Similarity Search (FAISS-based)

At query time, user question is embedded using the same embedding model. FAISS returns top-k child chunks by vector similarity (default k=12). Catches semantically related passages even if exact words differ. Example: Query "right to life" matches chunks containing "Article 21" even if phrasing differs.

### 6. BM25 Okapi Algorithm (Keyword-based Retrieval)

Probabilistic retrieval algorithm that scores chunks based on word frequency and rarity. Good for capturing exact legal terms and article references. Query is tokenized; BM25 calculates relevance score for each chunk. Returns top-k chunks by keyword relevance (default k=12). Example: Query "Article 32" exactly matches chunks containing "Article 32" writ petitions.

### 7. Reciprocal Rank Fusion (RRF) - Multi-signal Ranking

Combines ranking signals from Dense Search and BM25. For each chunk: **RRF score = (1 / (60 + dense_rank)) + (1 / (60 + bm25_rank))**. Chunks that rank well in either method get higher combined scores. Avoids the problem of relying on a single retrieval signal. Output: Re-ranked union of dense and sparse results.

### 8. Cross-Encoder Reranking (ms-marco-MiniLM-L-6-v2)

Fine-tuned transformer specifically trained for relevance ranking. Takes query and each candidate chunk as input; outputs relevance score (0-1). More accurate than similarity distance alone for legal passage ranking. Applied only to top candidates (top_k \* 3 or 10 candidates) to save compute. Example: Given query "wrongful detention", decides if chunk describes writ of habeas corpus vs. other rights.

### 9. Regex Pattern Matching (Section Detection)

Identifies legal structure (Article number, Part, Schedule) in text. Patterns: "Article \d+", "Part [IVXLC]+", "Schedule [A-Z0-9]+". Used to add section hints to metadata for transparency. Example: Automatically labels chunk as "Article 21" for display to user.

## Phase 4: Context Assembly and Generation

### 10. Context Window Expansion (Parent Mapping)

From top-k child chunks, retrieves associated parent chunks. Maintains up to 4 parents for final context (balances context vs. token limit). Avoids duplicate contexts if multiple child chunks come from same parent. Input: Child search results | Output: Broader legal context for the LLM.

### 11. Prompt Assembly (Template-based)

Combines: system prompt + conversation memory + retrieved context + user question. Memory is trimmed to last 8 turns to prevent context explosion. Sources are annotated as [Source 1], [Source 2], etc. Input: Search results, session state | Output: Final prompt for LLM.

### 12. Transformer-based LLM (Qwen 2.5 via Ollama)

Decoder-only transformer model with attention mechanisms generating final legal answer token-by-token based on prompt. Temperature set to 0.0 for deterministic, low-variance outputs. Uses constitutional vocabulary and legal reasoning learned from pretraining. Input: Assembled prompt | Output: Natural language legal explanation.

## Algorithm Flow Summary

**Indexing**: PDF → PyPDFLoader → RecursiveCharacterSplitter → Embeddings → FAISS Index

**At Query Time**: Query → Embedding → [Dense Search (FAISS) + BM25] → RRF Fusion → Cross-Encoder Rerank → Parent Context → Prompt Assembly → Qwen LLM → Final Answer

# Performance Matrix

| Evaluation Dimension | Metric                        | Current Status | Remarks                                                   |
| -------------------- | ----------------------------- | -------------- | --------------------------------------------------------- |
| Retrieval relevance  | Top-k relevance (qualitative) | Good           | Hybrid retrieval improves legal passage matching          |
| Source grounding     | Citation consistency          | Good           | Sources and page hints are returned with response         |
| Response clarity     | Human readability             | Good           | Tone control supports student-friendly and formal outputs |
| Latency              | End-to-end response time      | Moderate       | Depends on local hardware and model size                  |
| Robustness           | Ambiguous query handling      | Moderate       | Clarification behavior available; can be further tuned    |
| Legal reliability    | Constitutional alignment      | Good           | Prompt design enforces constitutional grounding           |

# Conclusion

Adhikar AI demonstrates a practical and scalable method for building a domain-specific legal assistant using retrieval-augmented generation. By grounding responses in the Indian Constitution and combining dense retrieval, sparse retrieval, and reranking, the system improves response relevance and trust. Local deployment with Ollama makes the project easier to reproduce and privacy-friendly. The architecture also supports usability through a modern interface and session-aware conversation flow. Future work can add benchmark-based evaluation, richer citation formatting, and expanded legal corpora, but the current implementation already provides a strong foundation for constitutional question answering and educational legal support.

# IEEE Conference Template

This report is structured to be transferred into IEEE conference format sections.

Suggested IEEE mapping:

- Paper Title -> Title
- Author Block -> KU ID Name
- Abstract -> Abstract (100 words)
- Introduction -> Intro (500 words)
- Dataset/Methodology -> Name of Data Set + Each Data Set Description
- Experimental Setup -> Model Deploy in D1 D2 D3
- Novelty/Contribution -> Novelty section
- Results -> Performance Matrix
- Conclusion -> Conclusion

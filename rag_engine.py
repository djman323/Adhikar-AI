import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder


ROOT_DIR = Path(__file__).resolve().parent
PDF_PATH = ROOT_DIR / "Indian Constitution.pdf"
VECTOR_DIR = ROOT_DIR / "vectorstore"
PARENT_INDEX_PATH = VECTOR_DIR / "parent_index"
CHILD_INDEX_PATH = VECTOR_DIR / "child_index"
META_PATH = VECTOR_DIR / "metadata.json"

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


@dataclass
class SearchResult:
    parent_id: str
    child_id: str
    page: int
    source: str
    section_hint: str
    text: str
    dense_rank: int
    bm25_rank: int
    rrf_score: float
    rerank_score: float


class ConstitutionRAGEngine:
    def __init__(self) -> None:
        self.embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
        self.parent_store: FAISS | None = None
        self.child_store: FAISS | None = None
        self.parent_map: Dict[str, Dict] = {}
        self.child_map: Dict[str, Dict] = {}
        self.child_tokens: List[List[str]] = []
        self.bm25: BM25Okapi | None = None
        self.reranker: CrossEncoder | None = None

    def ensure_index(self) -> None:
        if not PDF_PATH.exists():
            raise FileNotFoundError(f"Constitution PDF not found at: {PDF_PATH}")

        files_exist = (
            PARENT_INDEX_PATH.exists()
            and CHILD_INDEX_PATH.exists()
            and META_PATH.exists()
        )

        if not files_exist:
            self._build_index()

        self._load_index()

    def _build_index(self) -> None:
        VECTOR_DIR.mkdir(parents=True, exist_ok=True)

        loader = PyPDFLoader(str(PDF_PATH))
        pages = loader.load()

        parent_splitter = RecursiveCharacterTextSplitter(
            chunk_size=2200,
            chunk_overlap=220,
        )
        child_splitter = RecursiveCharacterTextSplitter(
            chunk_size=700,
            chunk_overlap=100,
        )

        parent_docs = parent_splitter.split_documents(pages)

        parent_payload: List[Dict] = []
        child_payload: List[Dict] = []

        for parent_idx, parent_doc in enumerate(parent_docs):
            parent_id = f"p-{parent_idx}"
            page = int(parent_doc.metadata.get("page", 0)) + 1
            source = str(parent_doc.metadata.get("source", "Indian Constitution.pdf"))
            parent_text = parent_doc.page_content.strip()
            section_hint = self._detect_section(parent_text)

            parent_payload.append(
                {
                    "id": parent_id,
                    "page": page,
                    "source": source,
                    "section_hint": section_hint,
                    "text": parent_text,
                }
            )

            child_docs = child_splitter.split_text(parent_text)
            for child_offset, child_text in enumerate(child_docs):
                child_id = f"c-{parent_idx}-{child_offset}"
                child_payload.append(
                    {
                        "id": child_id,
                        "parent_id": parent_id,
                        "page": page,
                        "source": source,
                        "section_hint": section_hint,
                        "text": child_text.strip(),
                    }
                )

        parent_texts = [item["text"] for item in parent_payload]
        parent_metas = [
            {
                "id": item["id"],
                "page": item["page"],
                "source": item["source"],
                "section_hint": item["section_hint"],
            }
            for item in parent_payload
        ]
        child_texts = [item["text"] for item in child_payload]
        child_metas = [
            {
                "id": item["id"],
                "parent_id": item["parent_id"],
                "page": item["page"],
                "source": item["source"],
                "section_hint": item["section_hint"],
            }
            for item in child_payload
        ]

        parent_index = FAISS.from_texts(parent_texts, self.embeddings, metadatas=parent_metas)
        child_index = FAISS.from_texts(child_texts, self.embeddings, metadatas=child_metas)

        parent_index.save_local(str(PARENT_INDEX_PATH))
        child_index.save_local(str(CHILD_INDEX_PATH))

        with META_PATH.open("w", encoding="utf-8") as f:
            json.dump(
                {
                    "parent_payload": parent_payload,
                    "child_payload": child_payload,
                },
                f,
                ensure_ascii=True,
                indent=2,
            )

    def _load_index(self) -> None:
        self.parent_store = FAISS.load_local(
            str(PARENT_INDEX_PATH),
            self.embeddings,
            allow_dangerous_deserialization=True,
        )
        self.child_store = FAISS.load_local(
            str(CHILD_INDEX_PATH),
            self.embeddings,
            allow_dangerous_deserialization=True,
        )

        with META_PATH.open("r", encoding="utf-8") as f:
            payload = json.load(f)

        parent_payload = payload.get("parent_payload", [])
        child_payload = payload.get("child_payload", [])

        self.parent_map = {item["id"]: item for item in parent_payload}
        self.child_map = {item["id"]: item for item in child_payload}

        self.child_tokens = [self._tokenize(item["text"]) for item in child_payload]
        self.bm25 = BM25Okapi(self.child_tokens)

        try:
            self.reranker = CrossEncoder(RERANKER_MODEL)
        except Exception:
            self.reranker = None

    def search(self, query: str, dense_k: int = 12, bm25_k: int = 12, final_k: int = 5) -> List[SearchResult]:
        if not self.child_store or not self.bm25:
            raise RuntimeError("Index is not loaded.")

        dense_results = self.child_store.similarity_search_with_score(query, k=dense_k)
        dense_ranked: Dict[str, int] = {}
        for rank, (doc, _) in enumerate(dense_results, start=1):
            child_id = doc.metadata.get("id")
            if child_id and child_id not in dense_ranked:
                dense_ranked[child_id] = rank

        tokenized_query = self._tokenize(query)
        bm25_scores = self.bm25.get_scores(tokenized_query)
        bm25_indices = sorted(range(len(bm25_scores)), key=lambda idx: bm25_scores[idx], reverse=True)[:bm25_k]
        bm25_ranked: Dict[str, int] = {}
        child_ids = list(self.child_map.keys())
        for rank, idx in enumerate(bm25_indices, start=1):
            child_id = child_ids[idx]
            bm25_ranked[child_id] = rank

        all_ids = set(dense_ranked.keys()) | set(bm25_ranked.keys())
        rrf_scored: List[Tuple[str, float]] = []
        for child_id in all_ids:
            d_rank = dense_ranked.get(child_id, 999)
            b_rank = bm25_ranked.get(child_id, 999)
            score = (1 / (60 + d_rank)) + (1 / (60 + b_rank))
            rrf_scored.append((child_id, score))

        rrf_scored.sort(key=lambda x: x[1], reverse=True)
        top_candidates = rrf_scored[: max(final_k * 3, 10)]

        rerank_pairs = [(query, self.child_map[child_id]["text"]) for child_id, _ in top_candidates]
        if self.reranker:
            rerank_scores = self.reranker.predict(rerank_pairs)
        else:
            rerank_scores = [score for _, score in top_candidates]

        merged = []
        for (child_id, rrf_score), rerank_score in zip(top_candidates, rerank_scores):
            child = self.child_map[child_id]
            merged.append(
                SearchResult(
                    parent_id=child["parent_id"],
                    child_id=child_id,
                    page=child["page"],
                    source=child["source"],
                    section_hint=child["section_hint"],
                    text=child["text"],
                    dense_rank=dense_ranked.get(child_id, 999),
                    bm25_rank=bm25_ranked.get(child_id, 999),
                    rrf_score=float(rrf_score),
                    rerank_score=float(rerank_score),
                )
            )

        merged.sort(key=lambda x: x.rerank_score, reverse=True)
        return merged[:final_k]

    def build_context(self, results: List[SearchResult], max_parents: int = 4) -> Tuple[str, List[Dict]]:
        picked_parents: List[str] = []
        sources: List[Dict] = []

        for result in results:
            if result.parent_id in picked_parents:
                continue
            picked_parents.append(result.parent_id)
            if len(picked_parents) >= max_parents:
                break

        context_blocks: List[str] = []
        for idx, parent_id in enumerate(picked_parents, start=1):
            parent = self.parent_map[parent_id]
            context_blocks.append(
                f"[Source {idx}]\\n"
                f"Section hint: {parent['section_hint']}\\n"
                f"Page: {parent['page']}\\n"
                f"Text: {parent['text']}"
            )
            sources.append(
                {
                    "source_id": idx,
                    "section_hint": parent["section_hint"],
                    "page": parent["page"],
                    "source": parent["source"],
                }
            )

        return "\\n\\n".join(context_blocks), sources

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return re.findall(r"[a-zA-Z0-9]+", text.lower())

    @staticmethod
    def _detect_section(text: str) -> str:
        patterns = [
            r"(Article\s+\d+[A-Z]?)",
            r"(Part\s+[IVXLC]+)",
            r"(Schedule\s+[A-Za-z0-9]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1)
        return "Constitution excerpt"

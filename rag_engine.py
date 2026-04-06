import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

from pypdf import PdfReader
from rank_bm25 import BM25Okapi


ROOT_DIR = Path(__file__).resolve().parent
PDF_PATH = ROOT_DIR / "Indian Constitution.pdf"
VECTOR_DIR = ROOT_DIR / "vectorstore"
META_PATH = VECTOR_DIR / "metadata.json"


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
        self.parent_map: Dict[str, Dict] = {}
        self.child_map: Dict[str, Dict] = {}
        self.child_tokens: List[List[str]] = []
        self.bm25: BM25Okapi | None = None

    def ensure_index(self) -> None:
        if not PDF_PATH.exists():
            raise FileNotFoundError(f"Constitution PDF not found at: {PDF_PATH}")

        if not META_PATH.exists():
            self._build_index()

        self._load_index()

    def _build_index(self) -> None:
        VECTOR_DIR.mkdir(parents=True, exist_ok=True)

        reader = PdfReader(str(PDF_PATH))

        parent_payload: List[Dict] = []
        child_payload: List[Dict] = []

        for parent_idx, page in enumerate(reader.pages):
            parent_id = f"p-{parent_idx}"
            page_number = parent_idx + 1
            source = "Indian Constitution.pdf"
            parent_text = (page.extract_text() or "").strip()
            if not parent_text:
                continue

            section_hint = self._detect_section(parent_text)

            parent_payload.append(
                {
                    "id": parent_id,
                    "page": page_number,
                    "source": source,
                    "section_hint": section_hint,
                    "text": parent_text,
                }
            )

            for child_offset, child_text in enumerate(self._split_text(parent_text, chunk_size=700, overlap=100)):
                child_id = f"c-{parent_idx}-{child_offset}"
                child_payload.append(
                    {
                        "id": child_id,
                        "parent_id": parent_id,
                        "page": page_number,
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
        with META_PATH.open("r", encoding="utf-8") as f:
            payload = json.load(f)

        parent_payload = payload.get("parent_payload", [])
        child_payload = payload.get("child_payload", [])

        self.parent_map = {item["id"]: item for item in parent_payload}
        self.child_map = {item["id"]: item for item in child_payload}

        self.child_tokens = [self._tokenize(item["text"]) for item in child_payload]
        self.bm25 = BM25Okapi(self.child_tokens)

    def search(self, query: str, dense_k: int = 12, bm25_k: int = 12, final_k: int = 5) -> List[SearchResult]:
        if not self.bm25:
            raise RuntimeError("Index is not loaded.")

        tokenized_query = self._tokenize(query)
        bm25_scores = self.bm25.get_scores(tokenized_query)
        bm25_indices = sorted(range(len(bm25_scores)), key=lambda idx: bm25_scores[idx], reverse=True)[:bm25_k]
        child_ids = list(self.child_map.keys())
        ranked_candidates: List[Tuple[str, float]] = []
        for rank, idx in enumerate(bm25_indices, start=1):
            child_id = child_ids[idx]
            score = float(bm25_scores[idx])
            ranked_candidates.append((child_id, score))

        ranked_candidates.sort(key=lambda item: item[1], reverse=True)
        top_candidates = ranked_candidates[: max(final_k * 3, 10)]

        merged = []
        for rank, (child_id, score) in enumerate(top_candidates, start=1):
            child = self.child_map[child_id]
            merged.append(
                SearchResult(
                    parent_id=child["parent_id"],
                    child_id=child_id,
                    page=child["page"],
                    source=child["source"],
                    section_hint=child["section_hint"],
                    text=child["text"],
                    dense_rank=rank,
                    bm25_rank=rank,
                    rrf_score=float(score),
                    rerank_score=float(score),
                )
            )

        merged.sort(key=lambda x: x.rrf_score, reverse=True)
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
    def _split_text(text: str, chunk_size: int, overlap: int) -> List[str]:
        if chunk_size <= 0:
            return [text]

        chunks: List[str] = []
        start = 0
        text_length = len(text)

        while start < text_length:
            end = min(start + chunk_size, text_length)
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            if end >= text_length:
                break
            start = max(end - overlap, start + 1)

        return chunks

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

 Last Updated: 2026-08-18 22:41:39 UTC
📌 Commit: 91559768
Week 9 · Day 3
Production RAG: Chunking, Hybrid Retrieval, Reranking & Query Transformation
Build a production RAG retriever over the capstone corpus — chunking with provenance, hybrid retrieval (keyword FTS + dense + RRF), reranking, and query transformation — so every result is scored and cited.

1
Topic 1 of 6
From naive to production RAG — the retrieve, rerank, generate pipeline
Why Do I Need to Know This?
The corpus is now ingested and clean from 9.2 Pipelines & Data Quality, so the team can finally build the feature filers asked for: an AI-Assist panel that answers a question from the team’s own documents. The fast way to build it — embed every chunk, take the top few by similarity, paste them into a prompt — demos well and then fails the moment a filer asks about an exact form number or expects to see a source. You need the production shape of a retrieval-augmented generation pipeline before you build any single stage, so each later topic has a place to attach.

This topic is the map for the whole lesson: chunking, hybrid retrieval, reranking, and query transformation are each one stage of the pipeline you sketch here.

Scenario
The team’s first RAG prototype answers easy questions well. Then a filer asks about "Form 8862," and the prototype returns three paragraphs of related guidance that never name the form, because the embedding blurred the exact token into nearby concepts. Worse, the answer arrives as free text with no indication of which document it came from, so a reviewer can’t check it. The team redesigns around a four-stage pipeline — transform the query, retrieve with both keyword and semantic search, rerank for precision, then generate a structured answer that names the chunks it used.

Theory
Why naive RAG breaks in production
RAG in its simplest form is one dense similarity search feeding a prompt. That shape has three predictable failures: it misses exact terms (a form number or statute citation the embedding smooths over), it returns near-duplicate chunks that crowd out other relevant text, and it produces an answer with no link back to a source. A federal feature cannot ship an answer no one can trace, so the naive shape is a prototype, not a product.

The production pipeline has four stages
Production RAG adds three stages around generation, each fixing one naive failure. The shape is: transform the query into a better search, retrieve candidates with both keyword and semantic search (so exact terms and meaning both land), rerank the candidates so the best ones are on top, and generate an answer that cites the chunks it used. Each stage is the subject of a later topic, so the team builds them one at a time against this contract.

The output is structured, not free text
The generator returns a structured object — an answer string plus a list of the chunk identifiers it relied on — not a paragraph of prose. OpenAI’s Structured Outputs enforces a JSON schema on the response, so the /assist endpoint and the SPA can parse the answer and render its citations reliably. (The older json_object "JSON mode" only guaranteed valid JSON, not that it matched your schema; schema-enforced Structured Outputs is its successor.) Provenance lives in the type itself: every retrieved chunk carries its source, so a citation is data the pipeline already has, not something the model is asked to invent.

!
Warning
A model asked to "include sources" in free text will happily fabricate plausible-looking citations. The defense is structural: the answer may only cite chunk identifiers that were actually retrieved, and the output validator (built in 9.4 pgvector, Embeddings & RAGAS) rejects any answer that cites a chunk the retriever never returned.

The four-stage production RAG pipeline
A filer’s question flows through query transformation, hybrid retrieval, reranking, and structured generation before it becomes a cited response.

filer question

transform query

hybrid retrieve

rerank

generate (answer + citations)

/assist response

Example
the retrieved-chunk and answer contracts
# rag/contracts.py — provenance lives in the type, not in the prose
from pydantic import BaseModel

class RetrievedChunk(BaseModel):
    id: str            # (1) stable id — what a citation points at
    text: str
    source: str        # (2) document + section the chunk came from
    score: float       # (3) fused retrieval score, used for ordering

class AssistAnswer(BaseModel):
    answer: str
    citations: list[str]   # (4) ids of the chunks the answer used
Copy
(1) Each chunk has a stable id; a citation is just that id, so it can be checked against what was retrieved.
(2) source travels with the chunk from the moment it is created, so provenance is never reconstructed after the fact.
(3) score is the fused retrieval score from the hybrid stage; the reranker overwrites the ordering later.
(4) citations lists chunk ids only — the validator confirms each one was actually retrieved before the answer reaches a filer.
AI Practice
Prompt it
Have Codex plan the full RAG architecture before writing any single stage.

Plan a production RAG pipeline for our document corpus. It must have four stages:
query transformation, hybrid retrieval (keyword + semantic), reranking, and
generation with structured output. The generated answer must be a typed object
with an answer string and a list of cited chunk ids. Show the data contract that
flows between stages and where provenance is attached. Do not write the stage
internals yet — just the architecture and the types.
Copy
Watch out
Codex often returns the naive shape — a single dense search into a prompt — because it is the most common example online. It also tends to make the answer free text with citations described in prose, which lets the model fabricate sources. Confirm the plan has all four stages, that retrieval is hybrid rather than dense-only, and that the answer is a structured object whose citations are chunk ids the retriever produced.

Verify
Read the returned architecture and check each of the four stages is present and named. Confirm the data contract carries a chunk source from retrieval through generation, and that the answer type lists citation ids rather than embedding sources in free text. Then, without AI, explain which naive-RAG failure each of the three added stages fixes.

Knowledge Check
1. A naive RAG prototype embeds every chunk, takes the top five by cosine similarity, and pastes them into the prompt. A filer asks about "Form 8862" by name and the answer never mentions the form. Which production stage most directly addresses this failure?
Reranking, because re-scoring the five retrieved chunks against the question would surface the form number that was buried lower in the list.
Structured output, because forcing the answer into a JSON schema makes the model include the exact form number it would otherwise omit.
Hybrid retrieval, because a keyword leg finds the exact term the dense embedding blurred away.
Query transformation, because rewriting the question into formal language guarantees the embedding will then match the form number exactly.
2. Why does production RAG return a structured object (answer plus citation ids) instead of a free-text answer that mentions its sources in prose?
So the API and UI can parse the answer and its citations reliably, and citations can be checked against what was retrieved.
Because free-text answers are always longer than structured ones, and shorter responses cost fewer tokens to generate at scale.
Because the OpenAI API rejects any request that does not specify a response schema, so structured output is mandatory.
Because a structured schema makes the model more accurate at answering the question than it would be with a free-text prompt.
3. The team wants every AI answer to be traceable to a source document. Where should a chunk’s provenance (its source document and section) live?
In a separate lookup table the generator queries after producing the answer, matching answer text back to the most similar source.
In the prompt instructions, which tell the model to remember and report which document each fact came from.
In the embedding vector itself, so similarity search returns the source alongside the semantic match automatically.
On the chunk itself, as a field attached when the chunk is created, so it travels through every stage.
4. A teammate proposes shipping the naive single-dense-search prototype because it "answers most questions fine in testing." What is the strongest reason to hold it back for a federal feature?
It will be slower in production than a four-stage pipeline, because adding stages reduces total latency through caching.
Its answers cannot be traced to a source, so a reviewer cannot verify them.
It uses more API tokens per call than a hybrid pipeline, making it too expensive to run at the cohort’s scale.
It cannot be wrapped behind a REST endpoint, so the SPA side-panel would have no way to call it.
2
Topic 2 of 6
Chunking strategies and provenance
Why Do I Need to Know This?
How you split documents decides what the retriever can ever find. Chunk too big and the answer is buried in noise the reranker has to fight through; chunk too small and a fact loses the context that makes it mean anything; ignore document structure and you tear a heading off the table it describes. Chunking is the highest-leverage decision in the whole pipeline, because every later stage can only work with the chunks you produce here.

It also carries the provenance the team promised: a chunk that does not know where it came from can never be a citation, so chunking is where traceability begins.

Scenario
The team’s first chunker splits on a fixed character count. It cuts a guidance document in the middle of a rate table, so one retrieved chunk holds the numbers without the column headers that say what they mean, and the model reads the wrong figure into its answer. The team switches to a structure-aware chunker that splits on the document’s headings, keeps each section whole, and stamps every chunk with the heading it lives under — both fixing the torn table and giving each chunk a citable source.

Theory
Four strategies, traded off on context versus precision
Chunking strategies sit on a spectrum from simple to structure-aware:

Fixed-size splits on a set number of tokens or characters, often with overlap. Simple and fast, but blind to structure, so it cuts through tables and sentences.
Semantic splits where the meaning shifts, using sentence-embedding similarity to find natural breakpoints. Better coherence, more compute.
Hierarchical respects the document’s own structure — sections and headings — keeping each unit intact. It is the most widely adopted production pattern because it resolves the precision-versus-context tension directly.
Propositional breaks text into atomic, self-contained facts. Highest precision, but expensive and can strip context a fact needs.
You pick by corpus shape: structured guidance documents reward hierarchical chunking; a wall of unstructured prose may need semantic.

i
Note
Benchmarks disagree on a single winner — one 2026 comparison found recursive fixed-size splitting beating semantic chunking on academic papers, while a clinical study found structure-aligned chunking far ahead of fixed-size. The lesson is to choose by your corpus and measure on your own eval set, not to adopt a strategy because it won someone else’s benchmark.

Provenance is attached at chunk creation
Every chunk carries its source document, section, and position as fields, set the moment the chunk is created. This is what makes a retrieved chunk citable and verifiable later. A chunk without provenance can be retrieved but never cited, which fails the program rule that every answer shows its sources.

Chunk invariants are testable
Two properties of good chunks are simple to assert in a unit test: no chunk exceeds the maximum length the embedding model and prompt budget allow, and no heading is orphaned from the body it introduces. The team’s chunker has tests for both, so a refactor that quietly breaks chunking fails CI instead of degrading answers in production.

One document, four chunking strategies
The same guidance document split four ways shows how each strategy trades context against precision; every resulting chunk keeps its source heading.

Fixed-size
Splits every N tokens, overlap optional. Fast and simple, but cuts through tables and sentences mid-thought.
Semantic
Splits where meaning shifts, using sentence-embedding similarity. Better coherence, more compute per document.
Hierarchical · production default
Splits on the document's own headings, keeping each section whole. Resolves the precision-vs-context trade-off.
Propositional
Breaks text into atomic facts. Highest precision, highest cost, can strip context a fact depends on.
Every chunk, whichever strategy made it, is stamped with {source, section, offset} — provenance is what makes it citable.
Example
a hierarchical chunker that carries provenance
# rag/chunk.py — split on headings, keep sections whole, stamp provenance
from rag.contracts import RetrievedChunk

MAX_CHARS = 1200

def chunk_document(doc_id: str, sections: list[tuple[str, str]]) -> list[RetrievedChunk]:
    chunks: list[RetrievedChunk] = []
    for offset, (heading, body) in enumerate(sections):       # (1) one unit per heading
        text = f"{heading}\n{body}"                           # (2) heading travels with body
        assert len(text) <= MAX_CHARS, f"chunk too long: {heading}"   # (3) invariant
        chunks.append(RetrievedChunk(
            id=f"{doc_id}#{offset}",
            text=text,
            source=f"{doc_id} — {heading}",                   # (4) citable provenance
            score=0.0,
        ))
    return chunks
Copy
(1) The document arrives already split into (heading, body) sections, so each chunk maps to one structural unit.
(2) The heading is kept with its body, so a retrieved chunk never loses the context that names its numbers.
(3) The max-length invariant is an assertion the unit tests exercise with a deliberately oversized section.
(4) source combines the document id and heading, giving every chunk a human-readable citation before it is ever retrieved.
AI Practice
Prompt it
Have Codex build a structure-aware chunker and prove its invariants.

Write a hierarchical chunker for our guidance documents. It must split on the
document's headings, keep each section intact, and attach {source, section,
offset} provenance to every chunk. Enforce a maximum chunk length. Include pytest
tests that assert no chunk exceeds the max length and no heading is separated from
its body. Use a guidance document with a table as a test fixture.
Copy
Watch out
Codex defaults to fixed-size character splitting because it is the most common example, which is exactly the strategy that tears tables apart. It may also drop provenance to keep the function short, or write tests that only check the happy path. Confirm the chunker splits on structure, that every chunk carries its source and section, and that a test actually feeds an oversized section and a table to prove the invariants hold.

Verify
Run the chunker on a document containing a table and confirm the table stays inside one chunk with its headers. Inspect a few chunks and confirm each has a populated source and section. Run the unit tests and confirm the max-length and no-orphan-heading assertions both execute against real fixtures. Then, without AI, explain why a chunk with no provenance can be retrieved but never cited.

Knowledge Check
1. A fixed-size chunker splits a guidance document in the middle of a rate table, separating the numbers from their column headers. A retrieved chunk then causes a wrong answer. Which chunking strategy most directly prevents this?
Propositional chunking, because breaking the table into one atomic fact per cell keeps each number with its own label.
Hierarchical chunking, because splitting on the document’s headings keeps each section and its table intact.
Semantic chunking, because embedding similarity will always detect the table boundary and avoid cutting through it.
Fixed-size chunking with a larger chunk size, because a big enough window will always contain any table in full.
2. Why must every chunk carry provenance (source document and section) as a field set when the chunk is created?
Because provenance fields increase the chunk’s embedding quality, so similarity search returns more relevant and better-ordered results.
Because a chunk without provenance can be retrieved but never cited, which breaks the rule that answers show sources.
Because the reranker uses the source field as its primary signal when re-scoring candidates against the query.
Because provenance lets the pipeline deduplicate chunks that came from the same document before retrieval runs.
3. The team adds a unit test asserting "no chunk exceeds the maximum length." What is the most useful fixture to test it against?
A document already known to chunk correctly, so the test confirms the chunker does not break working input.
An empty document, so the test confirms the chunker handles the no-content edge case without error.
A document with a section longer than the maximum, so the assertion actually fires on an oversized chunk.
A document with many short sections, so the test confirms the chunker produces a high total chunk count.
4. A 2026 benchmark shows fixed-size chunking beating semantic chunking on academic papers, while a clinical study shows structure-aligned chunking far ahead of fixed-size. What should the team conclude?
Fixed-size chunking is the safe default, since at least one rigorous benchmark ranked it first on real documents.
Semantic chunking should be avoided, because a published comparison found it underperforming basic fixed-size splitting on real-world documents.
Benchmarks are unreliable for chunking, so the team should pick whichever strategy is simplest to implement.
Choose the strategy by your own corpus and measure it on your own eval set, since results depend on document shape.
3
Topic 3 of 6
Hybrid retrieval — keyword, dense embeddings, and RRF
Why Do I Need to Know This?
Dense embeddings capture meaning, which is why they retrieve a paraphrase of a question even when no words match — and also why they miss an exact form number or statute citation, smoothing the literal token into nearby concepts. Keyword search has the opposite blind spot: it nails exact terms and misses paraphrase. A retriever that runs only one of them inherits its blind spot. Hybrid retrieval runs both and fuses the rankings, so the retriever finds what either alone would miss.

This is the stage that fixes the "Form 8862" failure from the first topic, and it produces the scored, cited candidate list the reranker refines next.

Scenario
A filer asks about "Form 8862" by name. The dense leg returns semantically related guidance that never names the form, because the embedding generalized the token away. The keyword leg finds the exact form immediately. Neither ranking alone is trustworthy on its own, so the team fuses the two lists with Reciprocal Rank Fusion, and the chunk that names the form lands near the top of the combined result.

Theory
Two retrieval legs with opposite blind spots
The keyword (lexical) leg ranks chunks by term overlap with the query, using Postgres full-text search over a tsvector column. The dense leg ranks by semantic similarity, using embeddings stored in pgvector (the store you formalize in 9.4 pgvector, Embeddings & RAGAS). Lexical search finds exact terms and misses paraphrase; dense search finds paraphrase and misses exact terms — each covers the other’s blind spot.

!
Important
Postgres full-text ranking is not true BM25
BM25 is the standard lexical scoring algorithm: it weights term frequency, inverse document frequency (rare terms count more), and document length. Postgres’s built-in ts_rank lacks the inverse-document-frequency term, so it approximates lexical ranking but is not BM25 (detail). For true BM25 inside Postgres, the team adds the open-source pg_search extension (ParadeDB), keeping the lexical leg in the same database as the dense leg. The exercises in this lesson build the keyword leg on built-in ts_rank deliberately, to keep the retriever dependency-free; adopt pg_search when the capstone needs true BM25 scoring.

Reciprocal Rank Fusion merges the two rankings
The two legs produce scores that are not comparable — a cosine distance and a lexical rank score are on different scales — so you cannot simply add them. Reciprocal Rank Fusion (RRF) sidesteps this by using only each chunk’s rank position in each list. For each chunk, RRF sums 1 / (k + rank) across the lists it appears in, where k is a small constant (commonly 60) that dampens the influence of the very top positions (RRF reference). A chunk ranked highly by both legs accumulates the highest fused score.

The retriever’s contract is a fused, scored, cited list
Because RRF is rank-based, it needs no score normalization and no training — it is a few lines of code that turn two ranked lists into one. The retriever returns that single fused list of chunks, each still carrying its provenance, as scored candidates for the reranker. That fused, cited candidate list is the contract every downstream stage depends on.

Two retrieval legs fused by RRF
The keyword and dense legs each rank the corpus independently; Reciprocal Rank Fusion merges them into one candidate list for the reranker.

filer query

keyword leg (Postgres FTS / ts_rank)

dense leg (pgvector)

Reciprocal Rank Fusion

fused candidate list

Example
fusing two ranked lists with rrf
# rag/fuse.py — combine two ranked lists by rank, not by raw score
def rrf(lexical: list[str], dense: list[str], k: int = 60) -> list[str]:
    scores: dict[str, float] = {}
    for ranking in (lexical, dense):                 # (1) each leg's ranked chunk ids
        for rank, chunk_id in enumerate(ranking):    # (2) rank is the position, 0-based
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank)  # (3)
    return sorted(scores, key=scores.get, reverse=True)   # (4) highest fused score first

def fuse(lexical: list[RetrievedChunk], dense: list[RetrievedChunk], k: int = 60) -> list[RetrievedChunk]:
    chunks_by_id = {c.id: c for c in lexical + dense}
    ranked_ids = rrf([c.id for c in lexical], [c.id for c in dense], k)
    return [chunks_by_id[i] for i in ranked_ids]      # (5) ids re-attached to full chunks, provenance intact
Copy
(1) Each leg passes a list of chunk ids already ordered best-first; their raw scores are never compared.
(2) rank is the position in the list, so a chunk near the top contributes more than one near the bottom.
(3) 1 / (k + rank) with k = 60 dampens the top positions so a single first-place result cannot dominate the fusion.
(4) A chunk that ranks well in both legs accumulates contributions from each and rises to the top of the fused list.
(5) rrf fuses ids only; fuse wraps it to look each id back up against chunks_by_id, so the caller gets back full RetrievedChunk objects with provenance intact.
AI Practice
Prompt it
Have Codex build the hybrid retriever and prove both legs contribute.

Write a hybrid retriever for our corpus. The keyword leg uses Postgres full-text
search; the dense leg uses pgvector similarity. Fuse the two ranked lists with
Reciprocal Rank Fusion using 1/(k+rank) and k=60. Return a single fused list of
chunks, each keeping its provenance. Include two tests: an exact-term query that
the dense leg alone would miss, and a paraphrase query that the keyword leg alone
would miss — both must return the right chunk after fusion.
Copy
Watch out
Codex may try to add the two legs’ raw scores together, which is wrong because a cosine distance and a lexical rank score are on different scales — RRF deliberately uses rank, not score. It may also drop one leg and call a single dense search "hybrid," or lose provenance during fusion. Confirm both legs run, that fusion is rank-based with k=60, and that an exact-term query and a paraphrase query each return the right chunk only because both legs contributed.

Verify
Run the exact-term query (a form number) and confirm the keyword leg surfaces the chunk the dense leg alone missed. Run the paraphrase query and confirm the dense leg surfaces the chunk the keyword leg alone missed. Confirm the fused list carries provenance on every chunk and that the fusion uses 1 / (k + rank), not summed raw scores. Then, without AI, explain why RRF needs no score normalization.

Knowledge Check
1. A filer searches for "Form 8862" by exact name. The dense (embedding) leg returns related guidance but never the form; the keyword leg returns the form immediately. Why does the dense leg miss an exact term?
Because embeddings only index the first few tokens of each chunk, so a form number deep in the text is never encoded.
Because the dense leg requires an exact string match to score a chunk, and minor formatting differences in the form number break it.
Because embeddings encode meaning and smooth an exact token into nearby concepts, losing the literal form number.
Because the dense leg ranks by document length, so a short reference to the form is always pushed below longer guidance.
2. Reciprocal Rank Fusion combines the keyword and dense rankings using each chunk’s rank rather than its raw score. Why use rank instead of score?
Because rank values are always integers, which are faster to sum than the floating-point scores the two legs produce.
Because the two legs’ raw scores are on different scales and not comparable, while ranks are.
Because rank-based fusion guarantees the top chunk from each leg always appears first in the fused list.
Because using ranks lets the fusion skip retrieving the dense leg whenever the keyword leg returns enough results.
3. In the RRF formula 1 / (k + rank) with k = 60, what does the constant k do?
It sets the maximum number of chunks that each retrieval leg may contribute to the fused candidate list before fusion stops.
It is the minimum fused score a chunk must reach to be included in the final candidate list.
It dampens the influence of the very top ranks so a single first-place result cannot dominate the fusion.
It weights the dense leg more heavily than the keyword leg, biasing the fusion toward semantic matches.
4. The team’s lexical leg uses Postgres ts_rank over a tsvector column. A reviewer notes this is "not really BM25." What is the accurate correction?
ts_rank lacks inverse document frequency, so it approximates lexical ranking; true BM25 in Postgres needs the pg_search extension.
ts_rank is exactly BM25 under a different name, so the reviewer is mistaken and no change is needed.
tsvector cannot do lexical ranking at all, so the team must move the keyword leg out of Postgres entirely.
BM25 and ts_rank differ only in speed, so the correction is to add a specialized index rather than change the underlying ranking algorithm at all.
4
Topic 4 of 6
Re-ranking for precision
Why Do I Need to Know This?
Hybrid retrieval is tuned for recall — it casts a wide net so the right chunk is somewhere in the candidate list. But "somewhere in the top twenty" is not good enough, because you only feed the generator a handful of chunks, and the most relevant one is often not in the first few. A reranking pass re-scores the candidates against the actual question and lifts the best ones to the top, so the generator sees the strongest evidence first.

This is the stage that turns good recall into good precision, and it is measurable: the team justifies its extra latency and cost with a number, not a hunch.

Scenario
The hybrid retriever returns twenty plausible chunks, but the one that actually answers the question is ranked ninth — outside the top five the team passes to the generator. A reranking pass re-scores all twenty against the question directly and promotes the ninth-ranked chunk into the top five. On the team’s seed evaluation set, precision at five rises measurably, which is the evidence that justifies adding the stage.

Theory
Retrieval optimizes recall, reranking optimizes precision
These are two different jobs run in sequence. Retrieval’s goal is recall: get every relevant chunk into the candidate list, even at the cost of some irrelevant ones. Reranking’s goal is precision: order that list so the most relevant chunks are first, because the generator only sees the top few (two-stage retrieval explained). A reranker re-scores each candidate against the query directly, rather than relying on the retrieval scores that got it into the list.

This program reranks with an LLM
A reranker can be a cross-encoder (a small model that scores a query-chunk pair locally, fast and cheap) or an LLM-rerank pass (the approved OpenAI model scores each candidate’s relevance). The two trade accuracy against latency and cost differently — an LLM call is markedly slower and more expensive per candidate than a local cross-encoder, since latency is dominated by model inference rather than vector search (comparison) — and which one wins on retrieval quality depends on your corpus, so treat it as a number to measure rather than a given.

This program uses LLM-rerank to stay on its single approved AI vendor; a local cross-encoder is the open-source alternative if a non-LLM reranker is preferred. You confirm the choice with your own measured p@5 and per-call cost, covered next.

»
Tip
Because LLM-rerank is the expensive stage, run it on a small candidate set. Retrieve twenty, rerank twenty, feed five. Reranking the entire corpus would be both slow and pointless — that is what the cheap retrieval stage is for.

What production spends here, and what a prototype should
A production reranker is either a local cross-encoder or an approved hosted reranker, and either way it takes one request carrying the whole candidate list and returns scores. At production volume the cost is a planned line item, and the team pays for a stronger model where the quality difference is measurable.

A prototype should reach the same design on a much smaller budget, and the levers are not equally powerful — worth knowing which one actually matters:

The model tier dominates, by roughly an order of magnitude. The same work scored by a frontier model rather than a small one is the difference between cents and tens of dollars. Pin the model family you intend to pay for, and then record the resolved model id the API returns with every score. A family alias like gpt-4o-mini can be repointed to a newer build, so the config alone does not tell you which model produced a number — the resolved id does, and two scores are only comparable when it matches.
Batching buys request count, not tokens. One call per question carrying the numbered candidate list sends roughly the same tokens as twenty single-candidate calls — the question is repeated instead of the chunks. What it buys is twenty times fewer requests: lower latency, rate-limit headroom, and a retry that costs one call instead of twenty. It is also the shape a real rerank API takes.
Caching buys the re-runs, which is where iteration cost actually accumulates. Key a cached result on everything that could change it — the question, the ordered candidate ids, the candidate content hashes, the resolved model id, and the prompt version. Key on any less and you will serve a stale ordering after changing the thing it depended on, which is worse than paying for the call.
Reranking is measured, not assumed
The justification for the latency and cost is a number: precision at k (p@k) on the seed evaluation set. For each question, the seed data identifies every chunk judged relevant, and p@5 is the fraction of the first five results that appear in that relevant set. The team averages those per-question scores before and after reranking; if reranking does not improve the mean, the stage is not earning its cost. This is the same "evaluated, or it does not ship" discipline that the RAGAS gate enforces in 9.4 pgvector, Embeddings & RAGAS.

»
Tip
Precision@5 includes the hit signal, but keeps the density signal too. For one question, 0.0 means no relevant chunk appeared in the top five. Any score above zero means there was at least one hit: 0.2 means one of five was relevant, 0.4 means two were relevant, and 1.0 means all five were relevant. Hit@5 and Success@5 reduce those nonzero cases to a binary 1; this lesson keeps Precision@5 because the generator receives all five chunks, so the amount of irrelevant context matters as well as the presence of one correct result. The nonzero-means-hit interpretation applies per question — do not infer an aggregate hit rate from the mean p@5.

Reranking reorders the candidate list for precision
The reranker re-scores every retrieved candidate against the query and promotes the best ones into the top-k the generator sees.

fused candidates (20)

LLM-rerank scores each vs query

reordered list

top 5 to generator

Example
an llm-rerank pass scored on p@5
# rag/rerank.py — re-score candidates against the query, keep the top k
def rerank(query: str, candidates: list[RetrievedChunk], k: int = 5) -> list[RetrievedChunk]:
    for c in candidates:
        c.score = llm_relevance(query, c.text)   # (1) 0..1 relevance, scored vs the query
    ranked = sorted(candidates, key=lambda c: c.score, reverse=True)   # (2)
    return ranked[:k]                             # (3) only the top k reach the generator

def precision_at_k(
    ranked: list[RetrievedChunk], relevant_ids: set[str], k: int = 5
) -> float:
    top = ranked[:k]
    return sum(c.id in relevant_ids for c in top) / k             # (4) relevance density
Copy
(1) llm_relevance asks the approved model to score how well a chunk answers the query, independent of its retrieval rank — like llm and embed elsewhere in this lesson, it stands in for the team’s shared LLM/embedding helpers rather than a literal import.
(2) The candidates are re-sorted by the new relevance score, so a chunk retrieved ninth can move into the top five.
(3) Only the top k chunks are passed on, keeping the LLM-rerank cost bounded to a small candidate set.
(4) precision_at_k counts all relevant chunks in the first k and divides by k; the reported seed-set score is the mean of the per-question values before or after reranking.
AI Practice
Prompt it
Have Codex add the reranking stage and measure its effect.

Add an LLM-rerank stage to our retriever. It takes the fused candidate list,
scores each candidate's relevance to the query with the approved OpenAI model,
re-sorts, and returns the top 5. Send the query and the NUMBERED candidate list in a
SINGLE request per query, not one request per candidate. Read the resolved model id
back off each response and record it with the score. Then write a script that measures precision-at-5
on our seed eval set both before and after reranking. Each seed example supplies
the complete set of relevant chunk ids; compute relevant results in the top 5
divided by 5 for each question, then print the mean across the set.
Keep the reranker on the retrieved candidate set only, never the whole corpus.
Copy
Watch out
Codex may rerank using the original retrieval scores instead of scoring candidates against the query afresh, which defeats the stage. It may also rerank the entire corpus rather than the small candidate set, making it slow and expensive; issue one request per candidate instead of one per query, multiplying request count and turning a single retry into twenty; or implement p@5 as a binary check for one expected chunk. Confirm the reranker scores each candidate against the query directly, runs only on the retrieved set, and that the script uses the full reviewed relevant-chunk set to print mean p@5 before and after.

Verify
Run the before-and-after script and confirm mean p@5 on the seed set is higher after reranking than before — if it is not, the stage is not earning its cost. Inspect one question’s score and explain how 0.0 means no hit while each additional relevant top-five chunk adds 0.2. Confirm the reranker runs on the ~20 retrieved candidates, not the whole corpus, and only the top 5 reach the generator. Then, without AI, explain why retrieval is tuned for recall while reranking is tuned for precision.

Knowledge Check
1. The hybrid retriever returns 20 candidates and the chunk that answers the question is ranked 9th, but the team only feeds the generator the top 5. What does a reranking stage do to fix this?
Re-scores all 20 candidates against the question directly and reorders them, so the 9th-ranked chunk can move into the top 5.
Retrieves progressively more candidates from the corpus until the answering chunk happens to land within the top 5 positions on its own.
Increases the number of chunks fed to the generator from 5 to 20 so the 9th-ranked chunk is always included.
Re-runs the dense embedding leg with a larger model so the answering chunk receives a higher similarity score.
2. Retrieval is described as optimizing recall and reranking as optimizing precision. What does this division of labor mean in practice?
Retrieval casts a wide net to get every relevant chunk into the list; reranking orders that list so the best are first.
Retrieval returns only chunks it is certain are highly relevant, and reranking then adds further candidates afterward to widen the final set.
Retrieval and reranking both optimize the same goal, so running both is redundant unless the corpus is very large.
Retrieval orders candidates by relevance and reranking removes duplicates so the final list is shorter.
3. This program uses LLM-rerank rather than a local cross-encoder. Given LLM-rerank is slower and costlier per call, why run it only on the retrieved candidate set?
Because the LLM can only accept about 20 chunks in a single context window, which strictly caps how many it can possibly rerank at once.
Because cross-encoders cannot score more than the retrieved set, and LLM-rerank must match that limit for fairness.
Because the candidate set is the only data with provenance attached, and the reranker requires provenance to score.
Because reranking the whole corpus would be slow and pointless, since cheap retrieval already narrowed it to candidates.
4. The team wants to justify the extra latency and cost of the reranking stage. What is the right way to do so?
Confirm the reranker calls the approved OpenAI model, since using the sanctioned vendor is what validates the stage.
Show that the reranked answers read better in a manual review of a few sample questions from the team.
Demonstrate the reranker reduces the number of candidates passed to the generator from 20 down to 5.
Measure precision-at-5 on the seed eval set before and after reranking and show it improved.
5. For one query, two of the first five chunks are in the reviewed relevant-chunk set. What do Precision@5 and Hit@5 report?
Precision@5 is 0.4, while Hit@5 is 1 because at least one relevant chunk appeared.
Precision@5 and Hit@5 are both 0.4 because both metrics use the number of relevant chunks as their numerator.
Precision@5 is 1, while Hit@5 is 0.4 because precision records success and hit rate records density.
Both are 1 because the query succeeded once a relevant chunk appeared anywhere in the top five.
5
Topic 5 of 6
Query transformation — rewriting, multi-query, and HyDE
Why Do I Need to Know This?
A user’s raw question is often a poor search query: too terse, ambiguous, or phrased nothing like the documents that hold the answer. "Can I still claim my kid" shares almost no vocabulary with a guidance section titled "dependent eligibility for a qualifying child," so literal retrieval finds little. Transforming the query before retrieval recovers results the raw question would miss, raising recall at the very front of the pipeline — before chunking, hybrid search, or reranking get a chance to work.

It is the last stage you build because it sits first in the flow, and it is most valuable exactly where filer questions are most colloquial.

Scenario
A filer types "can I still claim my kid." The literal query retrieves almost nothing useful, because the documents speak in formal terms the question never uses. The team rewrites it to "dependent eligibility for a qualifying child," and separately generates a short hypothetical answer and embeds that for the dense search. Both transformations retrieve the exact guidance section the raw question missed, and the filer never sees the rewriting happen.

Theory
Rewriting and multi-query reshape the question
Query rewriting reformulates a vague or colloquial question into a retrieval-friendly one, closer to how the documents are written. Multi-query goes further: it generates several reformulations of the question, runs retrieval on each, and unions the results, widening recall so a single awkward phrasing cannot sink the search. Both trade a little extra latency and an LLM call for a better chance of surfacing the right chunk.

HyDE embeds a hypothetical answer, not the question
HyDE (Hypothetical Document Embeddings) generates a hypothetical answer to the question and embeds that for the dense search, instead of embedding the question itself (HyDE overview). The reason is geometric: a hypothetical answer, even an imperfect one, sits closer in embedding space to the real answer than the question does, because answers resemble answers. So the dense leg searches with something shaped like its target.

!
Warning
HyDE’s hypothetical answer can hallucinate, and if it drifts far from the corpus the dense search is misdirected. It also adds latency — studies on small models measured a 25–60% increase over plain retrieval. Use it where it pays off (short, colloquial queries) and measure its recall effect rather than applying it to every query by default.

Query transformation runs before retrieval and trades cost for recall
All three techniques run ahead of the hybrid retriever and cost an extra LLM call’s worth of latency. They earn it most on short or colloquial queries, where the gap between how a filer asks and how the documents answer is widest. On a query that already matches the document vocabulary, transformation adds cost for little gain — which is why its recall effect is measured on the eval set, not assumed.

Three ways to transform a query before retrieval
A raw question is reshaped by rewriting, multi-query, or HyDE before it reaches the hybrid retriever, each technique suited to a different kind of query.

raw filer query

rewrite

multi-query

HyDE

hybrid retrieve

Example
rewriting a query and embedding a hyde answer
# rag/transform.py — reshape the query before it reaches retrieval
def rewrite(query: str) -> str:
    return llm(f"Rewrite this question in the formal terms a guidance "
               f"document would use, for search:\n{query}")          # (1)

def hyde_embedding(query: str) -> list[float]:
    hypothetical = llm(f"Write a short, plausible answer to:\n{query}")  # (2)
    return embed(hypothetical)                                        # (3) embed the answer

# "can I still claim my kid"
#   rewrite  -> "dependent eligibility for a qualifying child"        # (4)
#   HyDE     -> embed a drafted answer about qualifying-child rules
Copy
(1) rewrite asks the model to restate the question in document vocabulary, so the keyword leg has terms to match.
(2) HyDE first drafts a hypothetical answer to the question — it does not need to be correct, only answer-shaped.
(3) It embeds the hypothetical answer, not the question, because an answer sits closer to the real answer in embedding space.
(4) On a colloquial query, the rewrite recovers the formal terms the documents actually use; both feed the hybrid retriever.
AI Practice
Prompt it
Have Codex add query transformation and prove it recovers a missed result.

Add query transformation ahead of our hybrid retriever. Implement query rewriting
(reformulate into formal, document-style phrasing) and HyDE (generate a short
hypothetical answer and embed that for the dense leg). Take a colloquial query
that currently retrieves the wrong chunk, and show that after rewriting and HyDE
the correct chunk is retrieved. Print the retrieved chunk ids before and after.
Copy
Watch out
Codex commonly embeds the rewritten question for HyDE instead of embedding a hypothetical answer — that is just rewriting, not HyDE. It may also apply transformation to every query indiscriminately, adding latency where the query already matched the documents. Confirm HyDE embeds a generated answer, that rewriting produces document-style phrasing, and that the before-and-after chunk ids show the transformation actually recovered a chunk the raw query missed.

Verify
Run a colloquial query (like "can I still claim my kid") and confirm the raw query retrieves the wrong or no chunk, while the rewritten query and the HyDE embedding retrieve the correct guidance section. Confirm HyDE embeds a hypothetical answer, not the question. Then, without AI, explain why a hypothetical answer is closer in embedding space to the real answer than the question is.

Knowledge Check
1. A filer types "can I still claim my kid" and the literal query retrieves almost nothing, because the guidance is titled "dependent eligibility for a qualifying child." Which technique most directly recovers the result, and why?
Reranking, because re-scoring the retrieved candidates against the colloquial question would surface the formal guidance section.
Query rewriting, because reformulating the question into the document’s formal terms gives retrieval vocabulary to match.
Hierarchical chunking, because splitting the guidance on headings would place "qualifying child" in its own retrievable chunk.
Reciprocal Rank Fusion, because fusing the keyword and dense legs would combine into a match the literal query lacked.
2. HyDE (Hypothetical Document Embeddings) improves dense retrieval. What exactly does it embed for the search?
A short hypothetical answer the model generates for the question, because an answer sits closer to the real answer in embedding space.
The question rewritten into formal terms, because more formal phrasing always embeds noticeably closer to the source documents than casual phrasing does.
Both the question and every retrieved chunk together, because a combined embedding captures their relationship directly.
A summary of the whole corpus, because anchoring the query to the corpus average raises similarity for every document.
3. Query transformation adds an LLM call’s worth of latency ahead of retrieval. Where does it earn that cost best?
On queries that already use the exact vocabulary of the documents, where the extra phrasing locks in a guaranteed match.
On every query uniformly, because applying it consistently is the only way to keep retrieval behavior predictable.
On short or colloquial queries, where the gap between how a filer asks and how documents answer is widest.
On long, detailed queries, because more text gives the rewriter more material to reformulate into document terms.
4. A teammate enables HyDE on every query by default to "maximize recall everywhere." What is the risk?
HyDE will deduplicate the candidate list incorrectly, dropping relevant chunks that happen to share a similar hypothetical answer text.
HyDE will bypass the keyword leg entirely, so exact-term queries silently lose their lexical match.
HyDE will overwrite each chunk’s provenance with the hypothetical answer’s text, breaking citations downstream.
The hypothetical answer can hallucinate and drift from the corpus, misdirecting retrieval, and it adds latency on every call.
6
Topic 6 of 6
Practice — build the cited, scored RAG retriever
Why Do I Need to Know This?
Everything in this lesson converges on one deliverable: a retriever that takes a filer’s question and returns scored chunks with provenance, ready for the generator to cite. You will drive Codex to assemble the four stages — query transformation, chunking, hybrid retrieval with RRF, and LLM-reranking — over the team’s corpus, then verify the two things that make it production-grade rather than a demo: that an exact-term query and a colloquial query both find the right chunk, and that every returned chunk carries a citable source. This is the retriever whose 30 seed examples — each with a primary expected chunk and a reviewed relevant-chunk set — become the basis of the RAGAS eval set in 9.4 pgvector, Embeddings & RAGAS.

AI Practice
Prompt it
Have Codex assemble the full retriever, then you verify provenance and recall by hand.

Assemble our production RAG retriever over the corpus, composing four stages:
1. Query transformation (rewriting + HyDE) ahead of retrieval.
2. A hierarchical chunker that attaches {source, section, offset} to every chunk.
3. Hybrid retrieval: Postgres full-text (keyword) + pgvector (dense), fused with
   Reciprocal Rank Fusion (1/(k+rank), k=60).
4. An LLM-rerank pass that returns the top 5 candidates.
Return a typed list of RetrievedChunk (id, text, source, score). Then build a seed
set of 30 examples from the corpus. Each example has one primary expected chunk id
and every chunk id judged relevant. Report mean precision-at-5 across the seed set:
for each question, relevant chunks in the top 5 divided by 5, averaged over the set.
Copy
Watch out
Across the assembled pipeline, Codex repeats the per-stage failure modes: collapsing hybrid retrieval to a single dense search, adding raw scores instead of RRF, embedding the question rather than a hypothetical answer for HyDE, reranking with retrieval scores instead of scoring against the query, and dropping provenance somewhere in the chain so the final chunks cannot be cited. Walk the four stages in the returned code and confirm each is intact, then trust the seed-set number over the prose claim that it works.

Verify
Run an exact-term query (a form number) and a colloquial query and confirm both return the correct chunk in the top 5 — proving the keyword leg, the dense leg, and query transformation are all contributing. Inspect the returned chunks and confirm every one has a populated source, so the generator can cite it. Run the seed-set script and record precision-at-5 as the retriever’s baseline. Then, without AI, trace one query end-to-end through all four stages and name what each stage contributed to the final result.


# services/retrieval/eval/run_eval_set.py
import os
import sys
import time
from pathlib import Path
import dotenv

os.environ["TOKENIZERS_PARALLELISM"] = "false"
dotenv.load_dotenv(".env.local")
dotenv.load_dotenv(".env")

from services.retrieval.eval.test_ragas_gate import run_evaluation, load_thresholds

if __name__ == "__main__":
    thresholds = load_thresholds()
    judge_model = str(thresholds["judge_model"])
    eval_set_path = Path("services/retrieval/eval/eval_set.jsonl")

    t0 = time.time()
    print("==================================================", flush=True)
    print("Running Full RAGAS Evaluation on eval_set.jsonl", flush=True)
    print(f"Judge Model: {judge_model}", flush=True)
    print("==================================================", flush=True)

    res = run_evaluation(eval_set_path, judge_model, degraded=False)
    t1 = time.time()

    print(f"\nCompleted in {t1 - t0:.2f} seconds.", flush=True)
    print(f"Resolved Judge Model: {res.resolved_judge_model}", flush=True)
    print(f"Judge Calls: {res.judge_calls}", flush=True)
    print(f"Input Tokens: {res.input_tokens}", flush=True)
    print(f"Output Tokens: {res.output_tokens}", flush=True)
    print(f"Estimated Cost USD: ${res.estimated_cost_usd:.4f}", flush=True)
    print("\nIndividual Metric Scores vs Thresholds:", flush=True)

    all_passed = True
    for metric, score in res.scores.items():
        thresh = float(thresholds[metric])
        status = "PASS" if score >= thresh else "FAIL"
        if score < thresh:
            all_passed = False
        print(f"  - {metric}: {score:.4f} (threshold: {thresh:.2f}) -> {status}", flush=True)

    if not all_passed:
        print("\nFAILURE: One or more metrics failed the quality gate.", flush=True)
        sys.stdout.flush()
        os._exit(1)
    else:
        print("\nSUCCESS: All metrics passed the quality gate.", flush=True)
        sys.stdout.flush()
        os._exit(0)

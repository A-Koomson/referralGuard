# Evaluation: baseline

- Mode: live
- Model: openai/gpt-oss-120b
- Benchmark claim: LIVE — partial or failed LLM calls recorded; see live_errors
- Cases: 12
- Micro recall (primary): 0.0
- Micro precision: 0.0
- TP/FP/FN: 0/5/13
- Complete-case false-alarm rate: 0.0

12 synthetic cases demonstrate prototype behaviour, not clinical efficacy or lives saved.

| Case | TP | FP | FN | Recall | Precision | Ready OK |
|------|----|----|----|--------|-----------|----------|
| EVAL-01 | 0 | 0 | 0 | 1.0 | 1.0 | True |
| EVAL-02 | 0 | 0 | 1 | 0.0 | None | False |
| EVAL-03 | 0 | 1 | 1 | 0.0 | 0.0 | True |
| EVAL-04 | 0 | 0 | 1 | 0.0 | None | False |
| EVAL-05 | 0 | 2 | 1 | 0.0 | 0.0 | True |
| EVAL-06 | 0 | 0 | 1 | 0.0 | None | False |
| EVAL-07 | 0 | 0 | 1 | 0.0 | None | False |
| EVAL-08 | 0 | 0 | 1 | 0.0 | None | False |
| EVAL-09 | 0 | 0 | 1 | 0.0 | None | False |
| EVAL-10 | 0 | 1 | 1 | 0.0 | 0.0 | True |
| EVAL-11 | 0 | 0 | 1 | 0.0 | None | False |
| EVAL-12 | 0 | 1 | 3 | 0.0 | 0.0 | True |

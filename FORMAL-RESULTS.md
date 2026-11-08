# Formal MAPPO replay data

Source: https://github.com/ziqiang2344/contrail_aware_routing/blob/ab61cb4b5632b9b570518f7e44318d11e6655f3b/results/baneshi_mvp/policy_plans_seed10000/records.jsonl

The viewer includes all 12 deterministic records: C, CF, CT, CFT for training seeds 11, 22, 33. Every record is evaluated on scene seed 10000 (96 aircraft). Training run defaults to 11, the first listed run, without performance-based selection. The selector switches all four arms together in fleet replay and single-aircraft comparison.

Each record was validated against a rebuilt v5 scene: scenario identity, candidate validity, all per-flight values, horizon, and all aggregate terms. Checkpoint snapshot hashes and training commits are retained in scene-data.json. Physical feasibility is not a claim that every statistical training constraint was met; reported results are preserved unchanged.

Export from the research repository:

```sh
PYTHONPATH=src .venv/bin/python scripts/export_contrail_lab_candidates.py --policy-records /path/to/records.jsonl --out ../contrail-lab-site/scene-data.json
```

The full P0–P8 candidate export and B0/B1/B2 results are retained. Browser smoke checks covered MAPPO activation, training-run switching, CFT metrics, and single-aircraft comparison without console errors.

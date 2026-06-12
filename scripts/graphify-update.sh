#!/usr/bin/env bash
# Incremental knowledge graph update for pre-commit.
# ZERO TOKEN COST: only runs deterministic AST extraction on changed code files.
# Semantic (LLM) extraction is NEVER called here — contributors spend nothing.
# Docs/images that changed are noted in the manifest and skipped; run
# /graphify . --update manually (as a maintainer) to pick those up later.
# Skips silently if graphify hasn't been initialised in this repo.
# Never blocks a commit — any internal error exits 0.

GRAPHIFY_PYTHON="graphify-out/.graphify_python"
MANIFEST="graphify-out/manifest.json"

# Nothing to do if graphify hasn't been initialised in this repo.
[ -f "$GRAPHIFY_PYTHON" ] && [ -f "$MANIFEST" ] || exit 0

PYTHON=$(cat "$GRAPHIFY_PYTHON")

cleanup() {
  rm -f graphify-out/.graphify_incremental.json \
        graphify-out/.graphify_detect.json \
        graphify-out/.graphify_extract.json
}
trap cleanup EXIT

# ── Step 1: detect changed/deleted files ─────────────────────────────────────
"$PYTHON" - <<'EOF' || exit 0
import json, sys
from graphify.detect import detect_incremental
from pathlib import Path

result = detect_incremental(Path('.'))
Path('graphify-out/.graphify_incremental.json').write_text(
    json.dumps(result, ensure_ascii=False), encoding='utf-8'
)
new_total = result.get('new_total', 0)
deleted   = list(result.get('deleted_files', []))
if new_total == 0 and not deleted:
    sys.exit(1)  # nothing changed — triggers the || exit 0 above
print(f'[graphify] {new_total} changed, {len(deleted)} deleted')
EOF

# ── Step 2: populate .graphify_detect.json ───────────────────────────────────
"$PYTHON" - <<'EOF' || exit 0
import json
from pathlib import Path
r = json.loads(Path('graphify-out/.graphify_incremental.json').read_text(encoding='utf-8'))
Path('graphify-out/.graphify_detect.json').write_text(json.dumps({
    'files':             r.get('new_files', {}),
    'all_files':         r.get('files', {}),
    'total_files':       r.get('new_total', 0),
    'total_words':       r.get('total_words', 0),
    'skipped_sensitive': r.get('skipped_sensitive', []),
    'needs_graph':       True,
}, ensure_ascii=False), encoding='utf-8')
EOF

# ── Step 3: AST extraction on changed code files only — semantic NEVER runs ──
# Non-code files (docs, images) are intentionally ignored here to guarantee
# zero LLM calls and zero token spend for all contributors.
"$PYTHON" - <<'EOF' || exit 0
import json, sys
from graphify.extract import collect_files, extract
from pathlib import Path

detect  = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
changed = detect.get('files', {})

# Warn if non-code files changed so maintainers know to run a manual update.
non_code = {k: v for k, v in changed.items() if k != 'code' and v}
if non_code:
    counts = ', '.join(f'{len(v)} {k}' for k, v in non_code.items())
    print(f'[graphify] skipping semantic for {counts} (no token spend) — '
          f'run /graphify . --update manually to refresh')

code_files = []
for f in changed.get('code', []):
    p = Path(f)
    code_files.extend(collect_files(p) if p.is_dir() else [p])

if not code_files:
    # Only deletions or non-code changes — write empty extraction so the
    # merge step can still prune deleted nodes from graph.json.
    result = {'nodes': [], 'edges': [], 'hyperedges': [], 'input_tokens': 0, 'output_tokens': 0}
else:
    # extract() is pure AST — deterministic, no network, no LLM.
    result = extract(code_files, cache_root=Path('.'))
    print(f'[graphify] AST: {len(result["nodes"])} nodes from {len(code_files)} file(s)')

Path('graphify-out/.graphify_extract.json').write_text(
    json.dumps(result, ensure_ascii=False), encoding='utf-8'
)
EOF

# Abort gracefully if extraction produced nothing (e.g. graphify crashed).
[ -f graphify-out/.graphify_extract.json ] || exit 0

# ── Step 4: merge new extraction into existing graph (prune deleted) ─────────
"$PYTHON" - <<'EOF' || exit 0
import json
from pathlib import Path
from graphify.build import build_merge
from graphify.detect import save_manifest

new_ext     = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding='utf-8'))
incremental = json.loads(Path('graphify-out/.graphify_incremental.json').read_text(encoding='utf-8'))
deleted     = list(incremental.get('deleted_files', []))

G = build_merge(
    [new_ext],
    graph_path='graphify-out/graph.json',
    prune_sources=deleted or None,
)
print(f'[graphify] Merged: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges')

merged = {
    'nodes': [{'id': n, **d} for n, d in G.nodes(data=True)],
    'edges': [
        {**{k: v for k, v in d.items() if k not in ('_src', '_tgt', 'source', 'target')},
         'source': d.get('_src', u), 'target': d.get('_tgt', w)}
        for u, w, d in G.edges(data=True)
    ],
    'hyperedges':    list(G.graph.get('hyperedges', [])),
    'input_tokens':  new_ext.get('input_tokens', 0),
    'output_tokens': new_ext.get('output_tokens', 0),
}
Path('graphify-out/.graphify_extract.json').write_text(
    json.dumps(merged, ensure_ascii=False), encoding='utf-8'
)
save_manifest(incremental['files'])
print('[graphify] Manifest saved.')
EOF

# ── Step 5: rebuild graph.json with fresh clustering ────────────────────────
"$PYTHON" - <<'EOF' || exit 0
import json
from graphify.build import build_from_json
from graphify.cluster import cluster
from graphify.export import to_json
from pathlib import Path

extraction  = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding='utf-8'))
G           = build_from_json(extraction)
communities = cluster(G)
to_json(G, communities, 'graphify-out/graph.json')
print(f'[graphify] graph.json updated ({G.number_of_nodes()} nodes)')
EOF

# ── Step 6: regenerate interactive HTML ─────────────────────────────────────
graphify export html 2>/dev/null && echo '[graphify] graph.html updated' || true

# ── Step 7: stage outputs alongside the developer's own changes ─────────────
git add graphify-out/graph.json graphify-out/graph.html graphify-out/manifest.json 2>/dev/null || true

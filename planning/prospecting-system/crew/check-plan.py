#!/usr/bin/env python3
"""Read-only planning validator. No third-party dependencies or agent dispatch."""
import argparse
import fnmatch
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent


def overlap_path(a, b):
    """Conservative match for the directory/simple-segment globs used in this plan."""
    aa, bb = a.strip('/').split('/'), b.strip('/').split('/')
    for x, y in zip(aa, bb):
        if not (x == y or fnmatch.fnmatchcase(x, y) or fnmatch.fnmatchcase(y, x)):
            return False
    if len(aa) == len(bb):
        return True
    return (len(aa) < len(bb) and a.endswith('/')) or (len(bb) < len(aa) and b.endswith('/'))


def conflict(a, b):
    shared = set(a['exclusive_resources']) & set(b['exclusive_resources'])
    paths = [(x, y) for x in a['write_paths'] for y in b['write_paths'] if overlap_path(x, y)]
    return bool(shared or paths), sorted(shared), paths


def validate_plan(plan):
    tasks = plan['tasks']
    errors = []
    byid = {t['id']: t for t in tasks}
    if len(byid) != len(tasks):
        errors.append('Duplicate task IDs')
    if len({t['firstmate_id'] for t in tasks}) != len(tasks):
        errors.append('Duplicate Firstmate IDs')
    for t in tasks:
        for d in t['depends_on']:
            if d not in byid:
                errors.append(f"{t['id']}: missing dependency {d}")
        if not (ROOT / t['brief']).is_file():
            errors.append(f"{t['id']}: missing brief {t['brief']}")
        if t['kind'] == 'ship' and not t['write_paths']:
            errors.append(f"{t['id']}: ship has no write scope")
        if any(g not in plan['external_gates'] for g in t['external_gates']):
            errors.append(f"{t['id']}: unknown external gate")
    if errors:
        return errors, byid, {}
    ancestors, visiting = {}, set()

    def walk(k):
        if k in visiting:
            raise ValueError(f'Dependency cycle at {k}')
        if k in ancestors:
            return ancestors[k]
        visiting.add(k)
        result = set(byid[k]['depends_on'])
        for d in byid[k]['depends_on']:
            result.update(walk(d))
        visiting.remove(k)
        ancestors[k] = result
        return result

    try:
        for k in byid:
            walk(k)
    except ValueError as e:
        return [str(e)], byid, {}
    for i, a in enumerate(tasks):
        for b in tasks[i+1:]:
            c, locks, paths = conflict(a, b)
            if c and a['id'] not in ancestors[b['id']] and b['id'] not in ancestors[a['id']]:
                errors.append(f"Unordered ownership overlap {a['id']} / {b['id']}: resources={locks}, paths={paths}")
    return errors, byid, ancestors


def validate_state(state, plan, byid):
    errors = []
    if not isinstance(state, dict):
        return ['State must be a JSON object']
    for k, typ in [('completed', dict), ('active', list), ('passed_gates', dict)]:
        if not isinstance(state.get(k), typ):
            errors.append(f'State {k} must be {typ.__name__}')
    if errors:
        return errors
    done, active, gates = state['completed'], state['active'], state['passed_gates']
    if any(not isinstance(k, str) for k in active):
        return ['Active task IDs must be strings']
    if len(set(active)) != len(active):
        errors.append('Duplicate active task IDs')
    for k in set(done) | set(active):
        if k not in byid:
            errors.append(f'Unknown state task {k}')
    for g, evidence in gates.items():
        if g not in plan['external_gates'] or not isinstance(evidence, str) or not evidence.strip():
            errors.append(f'Invalid/unsupported external gate receipt: {g}')
    for k, receipt in done.items():
        if k not in byid:
            continue
        if not isinstance(receipt, dict):
            errors.append(f'{k}: completion receipt must be an object')
            continue
        if not isinstance(receipt.get('review'), str) or not receipt['review'].strip():
            errors.append(f'{k}: missing accepted independent review')
        if byid[k]['kind'] == 'ship':
            if not re.fullmatch(r'(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})', str(receipt.get('commit',''))):
                errors.append(f'{k}: missing actual merged Git SHA')
            if not isinstance(receipt.get('checks'), str) or not receipt['checks'].strip():
                errors.append(f'{k}: missing check evidence')
        elif not isinstance(receipt.get('report'), str) or not receipt['report'].strip():
            errors.append(f'{k}: missing accepted scout report')
    if errors:
        return errors
    for k in set(done) | set(active):
        missing = set(byid[k]['depends_on']) - set(done)
        if missing:
            errors.append(f'{k}: dependencies not completed: {sorted(missing)}')
        missing_gates = set(byid[k]['external_gates']) - set(gates)
        if missing_gates:
            errors.append(f'{k}: external gates not evidenced: {sorted(missing_gates)}')
    for k in set(done) & set(active):
        errors.append(f'{k}: both active and completed')
    for i, k in enumerate(active):
        for j in active[i+1:]:
            if conflict(byid[k], byid[j])[0]:
                errors.append(f'Active ownership conflict: {k} / {j}')
    return errors


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--state', type=Path, help='Read completion receipts from an operator-owned JSON file')
    ap.add_argument('--ready', action='store_true', help='List tasks ready under the supplied receipts')
    ap.add_argument('--batch', type=int, help='Suggest up to N ready tasks with disjoint ownership')
    ap.add_argument('--json', action='store_true', help='Emit the result as JSON')
    args = ap.parse_args()
    if args.batch is not None and args.batch < 1:
        ap.error('--batch must be positive')
    try:
        plan = json.loads((ROOT/'tasks.json').read_text())
        errors, byid, ancestors = validate_plan(plan)
        state = json.loads(args.state.read_text()) if args.state else {'completed':{},'active':[],'passed_gates':{}}
        if not errors:
            errors += validate_state(state, plan, byid)
    except (OSError, ValueError, KeyError, TypeError) as e:
        errors = [str(e)]
    if errors:
        print(json.dumps({'valid':False,'errors':errors},indent=2) if args.json else '\n'.join('ERROR: '+e for e in errors))
        return 1
    done, active = set(state['completed']), set(state['active'])
    ready = [t for t in plan['tasks'] if t['id'] not in done|active
             and set(t['depends_on']) <= done
             and set(t['external_gates']) <= set(state['passed_gates'])
             and not any(conflict(t,byid[k])[0] for k in active)]
    batch = []
    if args.batch:
        # Prioritize tasks with more downstream consumers; prefer live proof when ready.
        ordered = sorted(ready, key=lambda t:(t['key']!='provider-proof',-sum(t['id'] in a for a in ancestors.values()),t['id']))
        for t in ordered:
            if not any(conflict(t,other)[0] for other in batch):
                batch.append(t)
            if len(batch) == args.batch:
                break
    result={'valid':True,'task_count':len(byid),'completed':len(done),'active':sorted(active),
            'ready':[t['id'] for t in ready],'suggested_batch':[t['id'] for t in batch],
            'note':'Planning only. Receipt contents, merged commits and authorizations must be independently verified.'}
    if args.json:
        print(json.dumps(result,indent=2))
    else:
        print(f"Valid: {len(byid)} tasks; acyclic dependencies; no unordered overlapping write scopes.")
        if args.ready or args.batch:
            print(f"Completed receipts: {len(done)}; active: {len(active)}.")
            for t in (batch if args.batch else ready):
                print(f"{t['id']}  {t['title']}  [{t['brief']}]")
            if not (batch if args.batch else ready):
                print('No ready tasks with current receipts and gates.')
            print(result['note'])
    return 0


if __name__ == '__main__':
    sys.exit(main())

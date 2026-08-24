"""Print the English strings a locale is still missing, as compact JSON.

    python3 scripts/missing.py ar orders kyc

Used while filling in a translation catalogue: the output is the exact shape
`msgpatch.apply` takes back.
"""
import json, sys

loc = sys.argv[1]
namespaces = sys.argv[2:]
en = json.load(open("src/messages/en.json", encoding="utf8"))
own = json.load(open(f"src/messages/{loc}.json", encoding="utf8"))


def diff(a, b):
    out = {}
    for k, v in a.items():
        if isinstance(v, dict):
            sub = diff(v, b.get(k) if isinstance(b.get(k), dict) else {})
            if sub:
                out[k] = sub
        elif not isinstance(b, dict) or k not in b:
            out[k] = v
    return out


picked = {n: en[n] for n in namespaces} if namespaces else en
base = {n: own.get(n, {}) for n in namespaces} if namespaces else own
print(json.dumps(diff(picked, base), ensure_ascii=False, indent=1))

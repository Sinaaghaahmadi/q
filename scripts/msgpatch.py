"""Merge a nested dict of messages into one locale catalogue, in place.

Used from throwaway scripts while editing copy: `python3 scripts/msgpatch.py`
is never run on its own. Key order is preserved for existing keys and new
namespaces are appended, so diffs stay readable.
"""
import json, sys, collections


def merge(base, overlay):
    for k, v in overlay.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            merge(base[k], v)
        else:
            base[k] = v


def apply(locale, overlay):
    path = f"src/messages/{locale}.json"
    with open(path, encoding="utf8") as fh:
        data = json.load(fh, object_pairs_hook=collections.OrderedDict)
    merge(data, overlay)
    with open(path, "w", encoding="utf8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    return path

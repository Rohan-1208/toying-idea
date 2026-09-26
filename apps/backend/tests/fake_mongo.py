"""Tiny in-memory async MongoDB stand-in for tests (supports the subset the app uses)."""
from __future__ import annotations

import copy
import itertools
import re
from dataclasses import dataclass
from typing import Any

_counter = itertools.count(1)


class FakeObjectId(str):
    pass


def _get(doc: Any, path: str) -> list[Any]:
    """Return all values at a dotted path (arrays fan out, Mongo-style)."""
    cur = [doc]
    for part in path.split("."):
        nxt = []
        for c in cur:
            if isinstance(c, dict):
                if part in c:
                    nxt.append(c[part])
            elif isinstance(c, list):
                for el in c:
                    if isinstance(el, dict) and part in el:
                        nxt.append(el[part])
        cur = nxt
    out = []
    for v in cur:
        out.append(v)
        if isinstance(v, list):
            out.extend(v)
    return out


def _cmp(op: str, vals: list[Any], arg: Any) -> bool:
    if op == "$eq":
        return arg in vals or (arg is None and not vals)
    if op == "$ne":
        return not _cmp("$eq", vals, arg)
    if op == "$in":
        return any(a in vals for a in arg) or (None in arg and not vals)
    if op == "$nin":
        return not _cmp("$in", vals, arg)
    if op == "$exists":
        return bool(vals) == bool(arg)
    if op == "$regex":
        return any(isinstance(v, str) and re.search(arg, v) for v in vals)
    ops = {"$gt": lambda a, b: a > b, "$gte": lambda a, b: a >= b, "$lt": lambda a, b: a < b, "$lte": lambda a, b: a <= b}
    if op in ops:
        return any(v is not None and type(v) is type(arg) and ops[op](v, arg) for v in vals if not isinstance(v, list))
    raise NotImplementedError(op)


def match(doc: dict, flt: dict) -> bool:
    for k, cond in (flt or {}).items():
        if k == "$or":
            if not any(match(doc, f) for f in cond):
                return False
            continue
        if k == "$and":
            if not all(match(doc, f) for f in cond):
                return False
            continue
        vals = _get(doc, k)
        if isinstance(cond, dict) and any(str(x).startswith("$") for x in cond):
            flags = re.I if "i" in str(cond.get("$options", "")) else 0
            for op, arg in cond.items():
                if op == "$options":
                    continue
                if op == "$regex":
                    if not any(isinstance(v, str) and re.search(arg, v, flags) for v in vals):
                        return False
                elif not _cmp(op, vals, arg):
                    return False
        else:
            if not _cmp("$eq", vals, cond):
                return False
    return True


def _set_path(doc: dict, path: str, value: Any) -> None:
    parts = path.split(".")
    for p in parts[:-1]:
        doc = doc.setdefault(p, {})
    doc[parts[-1]] = value


def _get_one(doc: dict, path: str) -> Any:
    for p in path.split("."):
        if not isinstance(doc, dict):
            return None
        doc = doc.get(p)
    return doc


def apply_update(doc: dict, upd: dict, inserting: bool = False) -> None:
    for op, fields in upd.items():
        for k, v in fields.items():
            if op == "$set":
                _set_path(doc, k, copy.deepcopy(v))
            elif op == "$setOnInsert":
                if inserting:
                    _set_path(doc, k, copy.deepcopy(v))
            elif op == "$inc":
                _set_path(doc, k, (_get_one(doc, k) or 0) + v)
            elif op == "$push":
                lst = _get_one(doc, k)
                if lst is None:
                    lst = []
                    _set_path(doc, k, lst)
                lst.append(copy.deepcopy(v))
            elif op == "$addToSet":
                lst = _get_one(doc, k)
                if lst is None:
                    lst = []
                    _set_path(doc, k, lst)
                items = v["$each"] if isinstance(v, dict) and "$each" in v else [v]
                for it in items:
                    if it not in lst:
                        lst.append(it)
            elif op == "$unset":
                parts = k.split(".")
                d = doc
                for p in parts[:-1]:
                    d = d.get(p, {})
                d.pop(parts[-1], None)
            else:
                raise NotImplementedError(op)


@dataclass
class Result:
    inserted_id: Any = None
    matched_count: int = 0
    modified_count: int = 0
    deleted_count: int = 0
    upserted_id: Any = None


class Cursor:
    def __init__(self, docs: list[dict], projection: dict | None = None):
        self._docs = docs
        self._proj = projection
        self._sort: list[tuple[str, int]] = []
        self._limit = 0
        self._skip = 0

    def sort(self, key, direction=1):
        if isinstance(key, list):
            self._sort.extend(key)
        else:
            self._sort.append((key, direction))
        return self

    def limit(self, n):
        self._limit = n
        return self

    def skip(self, n):
        self._skip = n
        return self

    async def to_list(self, length=None):
        docs = list(self._docs)
        for key, direction in reversed(self._sort):
            docs.sort(key=lambda d: (_get_one(d, key) is None, _get_one(d, key) if _get_one(d, key) is not None else 0), reverse=direction < 0)
        docs = docs[self._skip:]
        if self._limit:
            docs = docs[: self._limit]
        if length:
            docs = docs[:length]
        out = []
        for d in docs:
            d = copy.deepcopy(d)
            if self._proj:
                excl = [k for k, v in self._proj.items() if not v]
                for k in excl:
                    d.pop(k, None)
            out.append(d)
        return out


class Collection:
    def __init__(self, name: str):
        self.name = name
        self.docs: list[dict] = []

    async def create_index(self, *a, **k):
        return "idx"

    def _find(self, flt):
        return [d for d in self.docs if match(d, flt or {})]

    def find(self, flt=None, projection=None):
        return Cursor(self._find(flt), projection)

    async def find_one(self, flt=None, projection=None):
        r = self._find(flt)
        return copy.deepcopy(r[0]) if r else None

    async def insert_one(self, doc):
        doc.setdefault("_id", FakeObjectId(f"oid{next(_counter):06d}"))
        self.docs.append(copy.deepcopy(doc))
        return Result(inserted_id=doc["_id"])

    async def insert_many(self, docs):
        for d in docs:
            await self.insert_one(d)

    async def update_one(self, flt, upd, upsert=False):
        r = self._find(flt)
        if r:
            apply_update(r[0], upd)
            return Result(matched_count=1, modified_count=1)
        if upsert:
            new = {k: v for k, v in flt.items() if not k.startswith("$") and not isinstance(v, dict)}
            apply_update(new, upd, inserting=True)
            await self.insert_one(new)
            return Result(upserted_id=new["_id"])
        return Result()

    async def update_many(self, flt, upd):
        r = self._find(flt)
        for d in r:
            apply_update(d, upd)
        return Result(matched_count=len(r), modified_count=len(r))

    async def find_one_and_update(self, flt, upd, return_document=False, upsert=False, sort=None):
        r = self._find(flt)
        if not r:
            return None
        before = copy.deepcopy(r[0])
        apply_update(r[0], upd)
        return copy.deepcopy(r[0]) if return_document else before

    async def delete_one(self, flt):
        r = self._find(flt)
        if r:
            self.docs.remove(r[0])
        return Result(deleted_count=len(r[:1]))

    async def count_documents(self, flt):
        return len(self._find(flt))


class FakeDB:
    def __init__(self):
        self._c: dict[str, Collection] = {}

    def __getitem__(self, name) -> Collection:
        return self._c.setdefault(name, Collection(name))

    async def command(self, *a, **k):
        return {"ok": 1}

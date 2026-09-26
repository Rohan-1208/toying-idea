"""Test bootstrap: stub the MongoDB driver so tests run without a database."""
from __future__ import annotations

import os
import sys
import types

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("AGENT_WORKER", "0")
os.environ.pop("ANTHROPIC_API_KEY", None)


def _stub(name: str, **attrs):
    if name in sys.modules:
        return sys.modules[name]
    m = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(m, k, v)
    sys.modules[name] = m
    return m


try:  # real driver available -> use it
    import motor.motor_asyncio  # noqa: F401
except Exception:
    from tests.fake_mongo import FakeObjectId

    class _Client:  # never used: tests patch get_db
        def __init__(self, *a, **k):
            pass

    _stub("motor")
    _stub("motor.motor_asyncio", AsyncIOMotorClient=_Client, AsyncIOMotorGridFSBucket=object)
    _stub("pymongo", ASCENDING=1, DESCENDING=-1, ReturnDocument=types.SimpleNamespace(AFTER=True, BEFORE=False))
    _stub("bson", ObjectId=FakeObjectId)

try:
    import passlib.context  # noqa: F401
except Exception:
    class _Ctx:
        def __init__(self, *a, **k):
            pass

        def hash(self, p):
            return "h:" + p

        def verify(self, p, h):
            return h == "h:" + p

    _stub("passlib")
    _stub("passlib.context", CryptContext=_Ctx)

import os
import uuid

import pytest
import requests

BASE_URL = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000")
ALLOWED_STATUS_CODES = {200, 201, 202, 204, 400, 401, 403, 404, 405, 409, 422}

# ──────────────────────────────────────────────
# Session-level helpers
# ──────────────────────────────────────────────

_session: requests.Session = requests.Session()
_token: str | None = None


def _get_token() -> str:
    global _token
    if _token:
        return _token

    _session.post(f"{BASE_URL}/api/v1/create-tables", timeout=20)
    email = f"pytest_{uuid.uuid4().hex[:10]}@example.com"
    password = "PytestPass123!"
    _session.post(
        f"{BASE_URL}/api/v1/auth/register",
        json={"first_name": "Pytest", "last_name": "Runner", "email": email,
              "role": "admin", "phone": "+212600000001", "password": password},
        timeout=20,
    )
    resp = _session.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    _token = resp.json()["access_token"]
    return _token


def _get_openapi() -> dict:
    return _session.get(f"{BASE_URL}/openapi.json", timeout=20).json()


def _build_path(path_template: str, operation: dict) -> str:
    result = path_template
    for p in operation.get("parameters", []):
        if p.get("in") != "path":
            continue
        name = p["name"]
        value = "1" if p.get("schema", {}).get("type") == "integer" else "sample-id"
        result = result.replace(f"{{{name}}}", value)
    return result


def _build_query_params(operation: dict) -> dict:
    params = {}
    for p in operation.get("parameters", []):
        if p.get("in") != "query" or not p.get("required", False):
            continue
        t = p.get("schema", {}).get("type")
        params[p["name"]] = 1 if t == "integer" else (1.0 if t == "number" else "sample")
    return params


def _body_for_endpoint(path: str, method: str) -> dict:
    if path == "/api/v1/auth/register" and method == "post":
        return {"first_name": "Another", "last_name": "User",
                "email": f"r_{uuid.uuid4().hex[:8]}@example.com",
                "role": "driver", "phone": "+212600000002", "password": "PytestPass123!"}
    if path == "/api/v1/auth/login" and method == "post":
        return {"email": "unknown@example.com", "password": "wrong"}
    return {}


# ──────────────────────────────────────────────
# Build parametrize list at import time
# ──────────────────────────────────────────────

def _collect_cases() -> list[tuple[str, str, dict]]:
    try:
        openapi = _get_openapi()
    except Exception:
        return []
    cases = []
    for path, path_item in openapi.get("paths", {}).items():
        for method, operation in path_item.items():
            if method.lower() not in {"get", "post", "put", "delete", "patch"}:
                continue
            cases.append((method.upper(), path, operation))
    return cases


_CASES = _collect_cases()
_IDS  = [f"{m} {p}" for m, p, _ in _CASES]


# ──────────────────────────────────────────────
# One test per endpoint
# ──────────────────────────────────────────────

@pytest.mark.integration
@pytest.mark.parametrize("method,path,operation", _CASES, ids=_IDS)
def test_endpoint(method: str, path: str, operation: dict):
    token   = _get_token()
    headers = {"Authorization": f"Bearer {token}"} if operation.get("security") else {}
    full    = _build_path(path, operation)
    params  = _build_query_params(operation)
    json_body = None
    if operation.get("requestBody") and method in {"POST", "PUT", "PATCH"}:
        json_body = _body_for_endpoint(path, method.lower())

    response = _session.request(
        method=method,
        url=f"{BASE_URL}{full}",
        headers=headers,
        params=params,
        json=json_body,
        timeout=30,
    )

    assert response.status_code in ALLOWED_STATUS_CODES, (
        f"Status inattendu {response.status_code}\n"
        f"URL : {method} {full}\n"
        f"Body: {response.text[:400]}"
    )

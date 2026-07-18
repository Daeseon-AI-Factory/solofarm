"""Shared clean-install import setup for BINJO API tests."""

import os
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[4]

# `app` is a common package name in editable Python environments. Explicit test
# roots prevent an unrelated installed project from being imported by accident.
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(API_ROOT))

# Never inherit a developer shell's production connection while collecting unit
# tests. Integration tests must opt into their own explicit test-only database.
os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost/test"
os.environ["DIRECT_URL"] = "postgresql://test:test@localhost/test"
# Must satisfy the >=32-char CoreSettings startup guard (see core/config.py).
os.environ["JWT_SECRET"] = "unit-test-secret-0123456789abcdef"

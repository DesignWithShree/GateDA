
"""GATE DA Companion API. Run from the project root: python -m uvicorn backend.main:app --port 8765"""

import datetime as dt
import json
import shutil
from pathlib import Path
from typing import List, Optional

import base64
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import backup, core, llm, rag, scheduler, srs, study
from .core import LIB, conn, safe_path
from .syllabus import (
    SECTION_BOOKS,
    SECTION_RESOURCES,
    SUBJECT_BOOKS,
    SUBJECT_CODE,
    SUBJECT_ORDER,
    SUBJECT_RESOURCES,
)

core.init_db()

app = FastAPI(title="GATE DA Companion")

# Allow requests from the deployed Vercel frontend and local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://gate-da-lime.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(study.router)
app.include_router(backup.router)
backup.start_auto_backup()

# Optional password for public deployments.
APP_PASSWORD = os.environ.get("APP_PASSWORD", "")


@app.middleware("http")
async def password_gate(request, call_next):
    if APP_PASSWORD and request.url.path != "/healthz":
        ok = False
        h = request.headers.get("authorization", "")
        if h.lower().startswith("basic "):
            try:
                ok = (
                    base64.b64decode(h[6:])
                    .decode()
                    .split(":", 1)[1]
                    == APP_PASSWORD
                )
            except Exception:
                ok = False

        if not ok:
            return JSONResponse(
                status_code=401,
                content={"detail": "Password required"},
                headers={
                    "WWW-Authenticate": 'Basic realm="GATE DA Companion"'
                },
            )

    return await call_next(request)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


# Keep all the remaining existing code below this point unchanged:
# prompts, state/progress, library, RAG, chat, coach, plans,
# activity, mock tests, flashcards, settings, and frontend mounting.

import os

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def register_frontend(app: FastAPI, static_dir: str) -> None:
    """Serve the built React app, falling back to index.html for client-side routes."""
    if not os.path.isdir(static_dir):
        return

    static_root = os.path.realpath(static_dir)
    index_file = os.path.join(static_root, "index.html")

    assets_dir = os.path.join(static_root, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = os.path.realpath(os.path.join(static_root, full_path))
        if candidate.startswith(static_root + os.sep) and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(index_file)

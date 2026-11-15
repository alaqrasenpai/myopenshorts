import os
import sys
import subprocess
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
VENV_PYTHON = ROOT_DIR / "venv" / "Scripts" / "python.exe"

if not VENV_PYTHON.exists():
    VENV_PYTHON = sys.executable

def main():
    print("=" * 60)
    print("   🚀 StreamClip Studio AI - Starting Application")
    print("=" * 60)
    print(f"[*] Workspace Root: {ROOT_DIR}")
    print(f"[*] Backend Server: http://localhost:8000")
    print(f"[*] Frontend App:   http://localhost:8000 (Built SPA) or http://localhost:5173 (Dev)")
    print("-" * 60)

    # Check if frontend is built
    dist_index = FRONTEND_DIR / "dist" / "index.html"
    if not dist_index.exists():
        print("[*] Building frontend assets...")
        subprocess.run(["cmd", "/c", "npm.cmd", "run", "build"], cwd=str(FRONTEND_DIR), check=True)
        print("[✓] Frontend built successfully.")

    print("\n[+] Starting FastAPI Web Server on http://localhost:8000 ...")
    print("[+] Press Ctrl+C to stop.\n")

    os.chdir(str(BACKEND_DIR))
    subprocess.run([str(VENV_PYTHON), "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"])

if __name__ == "__main__":
    main()

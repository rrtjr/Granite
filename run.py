#!/usr/bin/env python3
"""
Quick start script for Granite
Run this to start the application without Docker
"""

import sys
import os
import subprocess
from pathlib import Path

def main():
    print("Starting Granite...\n")

    # Check if requirements are installed
    try:
        import fastapi
        import uvicorn
    except ImportError:
        print("Installing dependencies...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
    
    # Create data directories
    Path("data").mkdir(parents=True, exist_ok=True)
    Path("plugins").mkdir(parents=True, exist_ok=True)
    
    # Get port from environment variable or use default
    port = os.getenv("PORT", "8000")
    
    print("[OK] Dependencies installed")
    print("[OK] Directories created")
    print("\n" + "="*50)
    print("Granite is running!")
    print("="*50)
    print(f"\nOpen your browser to: http://localhost:{port}")
    print("\nTips:")
    print("   - Press Ctrl+C to stop the server")
    print("   - Your notes are in ./data/")
    print("   - Plugins go in ./plugins/")
    print(f"   - Change port with: PORT={port} python run.py")
    print("\n" + "="*50 + "\n")
    
    # Run the application
    subprocess.call([
        sys.executable, "-m", "uvicorn",
        "backend.main:app",
        "--reload",
        "--host", "0.0.0.0",
        "--port", port
    ])

if __name__ == "__main__":
    main()


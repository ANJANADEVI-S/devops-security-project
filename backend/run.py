"""
Entry point — Run the Flask development server.
Usage:  python run.py
"""

import os
from dotenv import load_dotenv

# Load .env file using explicit path (relative to this script)
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(dotenv_path=env_path, override=True)
print(f"[ENV] Loaded from: {env_path}")
print(f"[ENV] VAULT_MOCK_MODE = {os.getenv('VAULT_MOCK_MODE', 'NOT SET')}")

from src.app import create_app
from src.seed import seed

app = create_app()

if __name__ == "__main__":
    # Seed default manager on first run
    seed()

    port = int(os.getenv("PORT", 5000))
    print(f"\n🚀 Server running at http://localhost:{port}")
    print(f"📊 Metrics at http://localhost:{port}/metrics")
    print(f"❤️  Health at http://localhost:{port}/health\n")

    app.run(host="0.0.0.0", port=port, debug=True)

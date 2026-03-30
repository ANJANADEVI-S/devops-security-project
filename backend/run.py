"""
Entry point — Run the Flask development server.
Usage:  python run.py
"""

import os
from dotenv import load_dotenv

# Load .env file before anything else
load_dotenv()

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

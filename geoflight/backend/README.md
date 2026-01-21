# GeoFlight Planner - Backend

FastAPI backend for photogrammetric flight planning with DJI drones.

## Setup

1. Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the server:
```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cameras` | List available camera/drone presets |
| POST | `/api/calculate` | Calculate flight parameters |
| POST | `/api/generate-waypoints` | Generate waypoints for a mission |
| POST | `/api/generate-kmz` | Generate and download KMZ file |
| GET | `/health` | Health check |

## Running Tests

```bash
pytest
```

## Project Structure

```
backend/
├── app/
│   ├── main.py            # FastAPI app + endpoints
│   ├── config.py          # Configuration
│   ├── models.py          # Pydantic models
│   ├── calculator.py      # Photogrammetric calculations
│   ├── patterns/          # Flight pattern generators
│   ├── wpml_builder.py    # WPML XML generator
│   └── kmz_packager.py    # KMZ packager
└── tests/                 # Test files
```

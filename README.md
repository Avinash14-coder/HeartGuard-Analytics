# HeartAI Diagnostic System

This project has been upgraded to a modern architecture using React (Vite) for the frontend and FastAPI for the backend.

## Prerequisites
- Node.js (v16+)
- Python (3.9+)
- Groq API Key

## 1. Backend Setup

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate   # (Windows)
   # source venv/bin/activate # (Mac/Linux)
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure your API key:
   Open `backend/.env` and paste your Groq API key:
   ```env
   GROQ_API_KEY=your_actual_key_here
   ```
5. Start the API server:
   ```bash
   uvicorn main:app --reload
   ```

## 2. Frontend Setup

1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`.
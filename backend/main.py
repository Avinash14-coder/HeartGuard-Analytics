import os
import joblib
import pandas as pd
import numpy as np
import shap
import matplotlib
matplotlib.use('Agg') # non-interactive backend for server
import matplotlib.pyplot as plt
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
from fpdf import FPDF
from io import BytesIO
from datetime import datetime

# Load env variables
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# FastAPI App
app = FastAPI(title="HeartAI Diagnostic API")

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compatibility patch for scikit-learn 1.8 loading 1.6 models
import sklearn.compose._column_transformer as ct
if not hasattr(ct, '_RemainderColsList'):
    class _RemainderColsList(list):
        pass
    ct._RemainderColsList = _RemainderColsList

# Load machine learning model pipeline
try:
    pipeline = joblib.load("best_heart_model.pkl")
    rf_model = pipeline.named_steps['model']
    preprocessor = pipeline.named_steps['preprocessor']
except Exception as e:
    print(f"Warning: Model could not be loaded: {e}")
    pipeline = None

# Request Models
class PatientData(BaseModel):
    age: float
    sex: str
    cp: str
    trestbps: float
    chol: float
    fbs: str
    restecg: str
    thalch: float
    exang: str
    oldpeak: float
    slope: str
    ca: str
    thal: str

class ChatRequest(BaseModel):
    message: str
    history: list = []

class PDFRequest(BaseModel):
    patient_data: dict
    prediction_label: str
    risk_prob: float
    analysis_text: str

# Helper class for PDF
class HeartReport(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 20)
        self.set_text_color(211, 47, 47) 
        self.cell(0, 10, "HEART HEALTH DIAGNOSTIC REPORT", ln=True, align="C")
        self.set_font("helvetica", "I", 10)
        self.set_text_color(100)
        date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.cell(0, 10, f"Generated on: {date_str}", ln=True, align="C")
        self.line(10, 32, 200, 32)
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(128)
        self.cell(0, 10, f"Page {self.page_no()} | Clinical AI Analysis", align="C")

def clean_text(text):
    replacements = {"–": "-", "—": "-", "’": "'", "‘": "'", "“": '"', "”": '"', "\u2022": "*", "•": "*"}
    for original, replacement in replacements.items():
        text = text.replace(original, replacement)
    return text.encode('latin-1', 'ignore').decode('latin-1')

import re
def write_professional_text(pdf, ai_text):
    lines = ai_text.split('\n')
    pdf.set_font("helvetica", "", 11)
    
    for line in lines:
        line = line.strip()
        if not line:
            pdf.ln(3)
            continue
            
        # Headers Level 3
        if line.startswith('### '):
            pdf.ln(3)
            pdf.set_font("helvetica", "B", 13)
            pdf.set_text_color(211, 47, 47)
            pdf.cell(0, 8, clean_text(line.replace('### ', '')), ln=True)
            pdf.set_text_color(0)
            pdf.set_font("helvetica", "", 11)
        # Headers Level 2
        elif line.startswith('## '):
            pdf.ln(4)
            pdf.set_font("helvetica", "B", 15)
            pdf.set_text_color(211, 47, 47)
            pdf.cell(0, 8, clean_text(line.replace('## ', '')), ln=True)
            pdf.set_text_color(0)
            pdf.set_font("helvetica", "", 11)
        # Tables
        elif '|' in line:
            if '---' in line:
                continue # Skip markdown table separator
            cols = [c.strip().replace('**', '') for c in line.split('|') if c.strip()]
            if len(cols) > 0:
                col_width = (pdf.w - 20) / len(cols)
                # bold for headers
                if 'Risk' in line or 'Category' in line or 'Factor' in line:
                    pdf.set_font("helvetica", "B", 10)
                    pdf.set_fill_color(240, 240, 240)
                    for col in cols:
                        pdf.cell(col_width, 8, clean_text(col), border=1, fill=True)
                else:
                    pdf.set_font("helvetica", "", 10)
                    for col in cols:
                        # Max string length cutoff for fixed cell to prevent overflow
                        cel_text = clean_text(col)[:int(col_width)] 
                        pdf.cell(col_width, 8, cel_text, border=1)
                pdf.ln(8)
                pdf.set_font("helvetica", "", 11)
        # Bullet Points
        elif line.startswith('- ') or line.startswith('* '):
            text_val = line[2:].replace('**', '')
            pdf.set_x(15)
            pdf.multi_cell(0, 6, "* " + clean_text(text_val))
            pdf.set_x(10)
        # Numbered Lists
        elif re.match(r'^\d+\.\s', line):
            text_val = line.replace('**', '')
            pdf.set_x(15)
            pdf.multi_cell(0, 6, clean_text(text_val))
            pdf.set_x(10)
        # Bold Wraps (often used for subheadings)
        elif line.startswith('**') and line.endswith('**'):
            pdf.ln(2)
            pdf.set_font("helvetica", "B", 11)
            pdf.multi_cell(0, 6, clean_text(line.replace('**', '')))
            pdf.set_font("helvetica", "", 11)
        # Normal
        else:
            line_clean = clean_text(line.replace('**', ''))
            pdf.multi_cell(0, 6, line_clean)

def generate_pdf_byte_string(patient_data, prediction_label, risk_prob, ai_text, fig_bar, fig_pie):
    pdf = HeartReport()
    pdf.add_page()
    pdf.set_fill_color(245, 245, 245)
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 12, f"Assessment: {prediction_label}", ln=True, fill=True, border=1, align="C")
    pdf.ln(5)
    
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 10, "Patient Vital Parameters:", ln=True)
    pdf.set_font("helvetica", "", 10)
    for key, value in patient_data.items():
        pdf.cell(0, 7, f"* {key}: {value}", ln=True)
    
    import tempfile
    
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f_bar, \
         tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f_pie:
        buf_bar_name = f_bar.name
        buf_pie_name = f_pie.name
        
    try:
        fig_bar.savefig(buf_bar_name, format='png', bbox_inches='tight')
        fig_pie.savefig(buf_pie_name, format='png', bbox_inches='tight')
        
        pdf.image(buf_bar_name, x=10, y=pdf.get_y()+5, w=90)
        pdf.image(buf_pie_name, x=110, y=pdf.get_y()+5, w=80)
    finally:
        if os.path.exists(buf_bar_name): os.remove(buf_bar_name)
        if os.path.exists(buf_pie_name): os.remove(buf_pie_name)
    
    pdf.add_page()
    pdf.set_font("helvetica", "B", 16)
    pdf.set_fill_color(245, 245, 245)
    pdf.cell(0, 12, "AI Clinical Insights", ln=True, fill=True, border=1, align="C")
    pdf.ln(5)
    
    # Run the professional custom text formatter
    write_professional_text(pdf, ai_text)
    
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f_pdf:
        temp_pdf_name = f_pdf.name
    pdf.output(temp_pdf_name, 'F')
    
    with open(temp_pdf_name, 'rb') as f:
        pdf_data = f.read()
    
    if os.path.exists(temp_pdf_name): os.remove(temp_pdf_name)
    return pdf_data

@app.post("/api/predict")
def predict(data: PatientData):
    try:
        input_dict = data.dict()
        input_df = pd.DataFrame([input_dict])
        
        prob = pipeline.predict_proba(input_df)[:, 1][0]
        label = "Heart Disease Detected" if prob >= 0.6 else "No Heart Disease Detected"
        
        # Calculate SHAP values
        X_tx = preprocessor.transform(input_df)
        explainer = shap.TreeExplainer(rf_model)
        shap_vals = explainer.shap_values(X_tx)
        
        # Handle SHAP output formats
        if isinstance(shap_vals, list):
            current_sv = shap_vals[1].ravel()
        elif len(shap_vals.shape) == 3:
            current_sv = shap_vals[0, :, 1]
        else:
            current_sv = shap_vals.ravel()

        fn = preprocessor.get_feature_names_out()
        
        # We will return the sorted SHAP values to the frontend for charting
        shap_data = [{"feature": fn[i], "value": float(current_sv[i])} for i in range(len(fn))]
        # Sort by absolute magnitude but keep sign
        shap_data.sort(key=lambda x: abs(x["value"]), reverse=True)
        top_shap_data = shap_data[:10]
        
        return {
            "prediction": label,
            "probability": prob,
            "shap_values": top_shap_data,
            "shap_raw": {
                "positive": float(np.sum(current_sv[current_sv > 0])),
                "negative": float(np.abs(np.sum(current_sv[current_sv < 0])))
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze")
def analyze(payload: dict):
    prediction = payload.get("prediction", "Unknown")
    probability = payload.get("probability", 0.0)
    
    prompt = f"Analyze heart health: {prediction} with {probability:.2%} risk. Provide Risk Table, Diet Plan, and Priority Medical Actions."
    
    if not GROQ_API_KEY:
        return {"response": "Groq API Key not configured."}
        
    try:
        client = Groq(api_key=GROQ_API_KEY)
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
        )
        return {"response": chat_completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
def chat(req: ChatRequest):
    if not GROQ_API_KEY:
        return {"response": "Groq API Key not configured. Please set your credentials."}
        
    try:
        client = Groq(api_key=GROQ_API_KEY)
        messages = [{"role": "system", "content": "You are a medical assistant specialized in cardiology."}]
        for msg in req.history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": req.message})
        
        chat_completion = client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile",
        )
        return {"response": chat_completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/download_report")
def download_report(req: dict):
    # To generate the report, we reconstruct the plots based on patient_data
    try:
        patient_data = req.get("patient_data", {})
        prediction_label = req.get("prediction_label", "Unknown")
        risk_prob = req.get("risk_prob", 0.0)
        analysis_text = req.get("analysis_text", "")
        
        # Regenerate SHAP values for plots
        input_df = pd.DataFrame([patient_data])
        X_tx = preprocessor.transform(input_df)
        explainer = shap.TreeExplainer(rf_model)
        shap_vals = explainer.shap_values(X_tx)
        
        if isinstance(shap_vals, list):
            current_sv = shap_vals[1].ravel()
        elif len(shap_vals.shape) == 3:
            current_sv = shap_vals[0, :, 1]
        else:
            current_sv = shap_vals.ravel()

        fn = preprocessor.get_feature_names_out()
        num_show = min(10, len(current_sv))
        idx = np.argsort(np.abs(current_sv))[-num_show:]

        # Create plots
        fig_bar, ax_bar = plt.subplots(figsize=(5, 4))
        plt.barh(range(len(idx)), current_sv[idx], color='#d32f2f')
        plt.yticks(range(len(idx)), [fn[i] for i in idx])
        plt.title("Top Risk Contributors")

        fig_pie, ax_pie = plt.subplots(figsize=(5, 4))
        pos = np.sum(current_sv[current_sv > 0])
        neg = np.abs(np.sum(current_sv[current_sv < 0]))
        ax_pie.pie([pos, neg], labels=['Risk Factors', 'Protective'], 
                   colors=['#d32f2f', '#4caf50'], autopct='%1.1f%%')
        plt.title("Factor Balance")

        pdf_bytes = generate_pdf_byte_string(patient_data, prediction_label, risk_prob, analysis_text, fig_bar, fig_pie)
        
        # Close plots
        plt.close(fig_bar)
        plt.close(fig_pie)
        
        return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=Heart_Report.pdf"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

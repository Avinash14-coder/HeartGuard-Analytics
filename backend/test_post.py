import urllib.request
import json

payload = {
  "patient_data": {
    "age": 39, "sex": "Female", "cp": "Typical angina", "trestbps": 122, "chol": 190,
    "fbs": "False", "restecg": "Normal", "thalch": 178, "exang": "No", "oldpeak": 0.0,
    "slope": "Upsloping", "ca": "0", "thal": "Normal"
  },
  "prediction_label": "Test",
  "risk_prob": 0.5,
  "analysis_text": "Sample text."
}

data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request("http://localhost:8000/api/download_report", data=data, headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req) as res:
        print(res.status)
except Exception as e:
    print(e)
    if hasattr(e, 'read'):
        print(e.read().decode())

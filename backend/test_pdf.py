import os
from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("helvetica", "B", 14)
pdf.cell(0, 12, "Test String", ln=True)

try:
    res = pdf.output()
    print("Type of output:", type(res))
except Exception as e:
    print("Error:", str(e))

from fpdf import FPDF
try:
    from fpdf.html import HTMLMixin
    print("HTMLMixin available")
except Exception as e:
    print("HTMLMixin error", str(e))

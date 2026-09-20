"""Conservative raster-based PDF analysis. No OCR or ML claims."""
import fitz
import numpy as np
from werkzeug.exceptions import BadRequest

def analyze(data):
    try:
        doc=fitz.open(stream=data,filetype='pdf')
        if doc.needs_pass: raise BadRequest('Password-protected PDFs are not supported. Upload an unlocked copy.')
        if not 1 <= len(doc) <= 150: raise BadRequest('Please upload a PDF containing 1–150 pages.')
        pages=[]
        for i,page in enumerate(doc):
            pix=page.get_pixmap(matrix=fitz.Matrix(0.5,0.5),colorspace=fitz.csRGB,alpha=False)
            rgb=np.frombuffer(pix.samples,dtype=np.uint8).reshape(-1,3).astype(np.int16)
            ink=np.any(rgb<245,axis=1)
            colorful=(rgb.max(axis=1)-rgb.min(axis=1)>25)&ink
            coverage=float(ink.mean())
            blank=not ink.any()
            pages.append({'number':i+1,'blank':bool(blank),'color':bool(colorful.sum()>max(3,len(rgb)*.0001)),'coverage':round(coverage*100,3),'width':round(page.rect.width),'height':round(page.rect.height)})
        doc.close()
        return {'total_pages':len(pages),'blank_pages':[p['number'] for p in pages if p['blank']], 'color_pages':[p['number'] for p in pages if p['color']], 'bw_pages':[p['number'] for p in pages if not p['blank'] and not p['color']], 'pages':pages,'engine':'PyMuPDF · rule-based raster analysis','size':len(data)}
    except BadRequest: raise
    except Exception as e: raise BadRequest('This PDF could not be read. Try exporting a new PDF and uploading it again.') from e

def prepare(data,settings,selected):
    source=fitz.open(stream=data,filetype='pdf'); out=fitz.open()
    for page in selected: out.insert_pdf(source,from_page=page-1,to_page=page-1)
    result=out.tobytes(garbage=4,deflate=True); out.close(); source.close(); return result

def sample():
    doc=fitz.open()
    for i in range(1,7):
        page=doc.new_page()
        if i==3: continue
        page.insert_text((54,60),'AUTOPRINT AI / SAMPLE DOCUMENT',fontsize=12,color=(.15,.4,.8) if i in [2,5] else (0,0,0))
        page.insert_text((54,105),f'Electrical Engineering - Lab Record / Page {i}',fontsize=16)
        for line in range(10): page.insert_text((54,160+line*24),'Observation: Record the readings and compare the calculated results.',fontsize=10)
        if i in [2,5]: page.draw_rect(fitz.Rect(54,430,310,505),color=(.1,.4,.8),fill=(.1,.4,.8))
    data=doc.tobytes();doc.close();return data

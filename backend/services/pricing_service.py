import math,re
from werkzeug.exceptions import BadRequest
DEFAULT_PRICING={'a4_bw':1,'a4_duplex':1.5,'a4_color':5,'a3_bw':3,'a3_duplex':4.5,'a3_color':10}

def calculate(analysis,s,p):
    try:
        copies=int(s.get('copies',1)); nup=int(s.get('nup',1))
        if str(s.get('copies',1))!=str(copies) or copies<1 or copies>100: raise ValueError()
        if nup not in [1,2,4]: raise ValueError()
        paper=s.get('paper','A4'); mode=s.get('mode','bw');orientation=s.get('orientation','auto')
        if paper not in ['A4','A3'] or mode not in ['bw','color','auto'] or orientation not in ['auto','portrait','landscape']: raise ValueError()
        total=analysis['total_pages']; text=s.get('range','').strip(); selected=set()
        if not text: selected=set(range(1,total+1))
        else:
            for piece in text.split(','):
                if not re.fullmatch(r'\s*\d+(\s*-\s*\d+)?\s*',piece): raise BadRequest('Use a page range such as 1-4, 7, 9-12.')
                ends=[int(v) for v in piece.split('-')];start=ends[0];end=ends[-1]
                if start<1 or end>total or end<start: raise BadRequest(f'Page range must be between 1 and {total}.')
                selected.update(range(start,end+1))
        original=len(selected)*copies
        if s.get('remove_blank'): selected.difference_update(analysis['blank_pages'])
        selected=sorted(selected)
        if not selected: raise BadRequest('Choose at least one non-blank page to print.')
        duplex=bool(s.get('duplex',True)); color=set(analysis['color_pages'])
        # Price imposed physical sides; any side containing color is charged as color.
        groups=[selected[i:i+nup] for i in range(0,len(selected),nup)]
        types=[mode=='color' or (mode=='auto' and any(x in color for x in g)) for g in groups]
        prefix=paper.lower(); price=0
        for i,t in enumerate(types):
            if t: price+=p[prefix+'_color']
            elif duplex and ((i%2==0 and i+1<len(types) and not types[i+1]) or (i%2==1 and not types[i-1])): price+=p[prefix+'_duplex']/2
            else: price+=p[prefix+'_bw']
        sheets=math.ceil(len(groups)/(2 if duplex else 1))*copies
        return {'pages':len(selected),'selected_pages':selected,'impressions':len(groups)*copies,'sheets':sheets,'original_sheets':original,'saved_sheets':original-sheets,'color_pages':sum(1 for n in selected if mode=='color' or mode=='auto' and n in color)*copies,'bw_pages':sum(1 for n in selected if not(mode=='color' or mode=='auto' and n in color))*copies,'amount':round(price*copies,2),'settings':{'copies':copies,'nup':nup,'paper':paper,'mode':mode,'duplex':duplex,'orientation':orientation,'range':text,'remove_blank':bool(s.get('remove_blank'))}}
    except (ValueError,TypeError,KeyError): raise BadRequest('Check your print settings. Copies must be 1–100.')

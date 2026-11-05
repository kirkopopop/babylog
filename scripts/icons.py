# Render PNG app icons from public/icon.svg (run once; outputs committed).
import sys
from playwright.sync_api import sync_playwright
svg=open('public/icon.svg').read()
with sync_playwright() as p:
    b=p.chromium.launch()
    for size,name,pad in [(180,'icon-180.png',2),(192,'icon-192.png',0),(512,'icon-512.png',0),(512,'icon-512-maskable.png',1)]:
        pg=b.new_page(viewport={'width':size,'height':size})
        inner = svg.replace('rx="112"','rx="0"') if pad else svg
        pg.set_content(f'<html><body style="margin:0;background:{"#1c5cab" if pad else "transparent"}"><div style="width:{size}px;height:{size}px;{"padding:"+str(int(size*0.1))+"px;box-sizing:border-box" if pad==1 else ""}">{inner.replace("<svg ","<svg width=\"100%\" height=\"100%\" ")}</div></body></html>')
        pg.screenshot(path='public/'+name, omit_background=not pad)
    b.close()

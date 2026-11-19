"""Build the worksheet catalogue from the uploaded 2025/11 catalogue and user corrections."""
from pathlib import Path
import json,copy,re
from merge_weight_catalog import merge_pdf_catalog
root=Path(__file__).resolve().parents[1]
rows=[]
def add(name,spec,page,category,code=None,weight='',note=''):
 n=len(rows)+1
 rows.append(dict(id=f'sucoot-202511-{n:03}',code=code or f'自編-{n:03}',name=name,spec=spec,weight=weight,page=page,category=category,officialCode=bool(code),note=note))
add('U型上調整座','牙管 Ø48.2 × 600 × t5.0 mm；伸縮 80–450 mm',20,'主架與基座')
add('下調整座','牙管 Ø48.2 × 600 × t5.0 mm；底板 140 × 140 × t6 mm；伸縮 80–450 mm',20,'主架與基座')
add('標準基座','長 200 mm；Ø60.2 × t3.2 mm',20,'主架與基座')
for length in ['1.0','1.5','2.0','3.0']:add('主架',f'長 {length} m；Ø60.2 × t3.2 mm；圓盤間距 500 mm',20,'主架與基座')
add('平主架','未加裝方管連接棒之主架；長度請依需求填寫',20,'主架與基座')
add('連接棒','方管對角 52.5 × t3.0 mm；長 300 mm',20,'主架與基座')
for length in ['0.25','0.5']:add('輔助桿',f'長 {length} m；Ø60.2 × t3.2 mm',20,'主架與基座')
add('下底座','長 0.35 m；Ø60.2 × t3.2 mm',20,'主架與基座')
for length in ['0.6','0.9','1.2','1.5','1.8','2.4']:add('橫桿',f'長 {length} m；Ø48.6 × t2.3 mm',21,'橫桿、斜桿與定位桿')
for w,h in [('0.6','1.0'),('0.9','1.0'),('1.2','1.0'),('1.8','1.0'),('0.6','1.5'),('0.9','1.5'),('1.2','1.5'),('1.5','1.5'),('1.8','1.5'),('2.4','1.5')]:add('斜桿',f'{w} m × {h} m；Ø48.6 × t2.3 mm',21,'橫桿、斜桿與定位桿',note='尺寸組合依型錄原文，非桿件實體斜長。')
for w,h in [('1.5','1.2'),('1.5','1.5'),('1.8','1.2'),('1.8','1.5'),('1.8','1.8'),('2.4','1.5')]:add('定位桿',f'{w} m × {h} m；Ø48.6 × t2.3 mm',21,'橫桿、斜桿與定位桿')
add('雙C梁架','長 1.65 m；Ø60.2 × t3.2 mm；雙C槽鋼 75 × 40 × 5 × 7 mm',21,'梁架與配件',note='P.21 總長 1.65 m；圖示 900 mm 為另一尺寸。')
for spec,code in [('Ø48 mm','C50500'),('Ø60 mm','C60500'),('Ø60/48 mm','C60600')]:add('活動圓盤',spec,33,'梁架與配件',code=code)
add('插銷','雙C梁架構件；型錄未列尺寸',21,'梁架與配件',code='SL-45A')
add('組合插銷','型錄未列尺寸',19,'梁架與配件')
add('扳手','調整座用；型錄未另列尺寸',19,'梁架與配件')
add('彈簧銷','主架與方管連接棒固接用；型錄未列尺寸',20,'梁架與配件')
for length in ['1.8','2.4']:add('工作爬梯（配置）',f'長 {length} m × 寬 1.5 m；每層高 1.5 m',28,'爬梯與護欄',note='整體配置，非單片踏板；不套用踏板約重 48 kg。')
add('工作爬梯踏板（單組）','高 1.5 m；單組踏板約重 48 kg（非整座配置重量）',27,'爬梯與護欄',weight='48',note='型錄明列單組爬梯踏板約重，未指定哪一長度，不能套用到工作爬梯配置。')
add('重型鋁製爬梯','長 1.8 m × 高 1.5 m；含螺絲與扶手之整組',30,'爬梯與護欄',weight='16.53')
add('重型快速橫桿接頭','護欄橫桿固定用；型錄未列尺寸',31,'爬梯與護欄')
add('重型C型主架座（踏板用）','踏板側邊用；圖示搭配 Ø60.2 mm 平主架',31,'爬梯與護欄')
add('重型C型主架座（橫桿用）','橫桿用；型錄未另列尺寸',31,'爬梯與護欄')
for side in ['左','右']:add(f'L型掛板架（{side}）','增加 250 mm 高度處之腳踏階梯；型錄未列構件外形尺寸',31,'爬梯與護欄')
for width in [265,550]:
 for length in [1200,1500,1800]:add('腳踏板',f'長 {length} mm × 寬 {width} mm',32,'腳踏板與蓋板')
for length in [1200,1500,1800]:add('蓋板',f'長 {length} mm × 寬 265 mm',32,'腳踏板與蓋板')
add('托架（標架）','型錄未列尺寸',35,'特殊支撐與移動配件')
add('降架設備','型錄未列尺寸',36,'特殊支撐與移動配件')
add('移架輪','置於平面調整座下；放入前底板離地至少 75 mm',37,'特殊支撐與移動配件',note='75 mm 為安裝條件，非輪體尺寸。')
add('角鐵輪','圖示尺寸 113.6 mm；放入前底板離地至少 160 mm',37,'特殊支撐與移動配件',note='160 mm 為安裝條件，非輪體尺寸。')
add('T型調整座','H型鋼 150 × 75 × 5 × 7 mm，長 500 mm；高度可調範圍 300 mm',38,'特殊支撐與移動配件')
add('TB固定夾','次墊條應用配件；型錄未列尺寸',38,'特殊支撐與移動配件')
add('Top Beam（次墊條）','型錄未列尺寸',38,'特殊支撐與移動配件')
add('墊圈套座','管長 130 mm；Ø60.2 × t3.2 mm；頂板 220 × 220 × t10 mm',40,'超重支撐模組配件')
add('套座用固定勾','Ø1/2″ × 長 216 mm；單邊珠牙，電鍍',40,'超重支撐模組配件')
add('HN-15ET墊圈','Ø52 × 長 30 mm',40,'超重支撐模組配件',code='HN-15ET')
add('雙橫桿頭','長 90 mm；柱心至柱心 150 mm',40,'超重支撐模組配件')
add('超重型調整座','上下板 220 × 220 × t10 mm；牙管 Ø78 × t12 mm；伸縮 390–520 mm',40,'超重支撐模組配件')
add('轉折平台','工作爬梯配置用；型錄未列尺寸',28,'爬梯與護欄')
assert len(rows)==73
previous=copy.deepcopy(rows);items=[]
for item in rows:
 name=item['name'];code=None
 if name=='U型上調整座':code='U48601'
 elif name=='下調整座':code='J48601'
 elif name=='標準基座':code='V62020'
 elif name in ['主架','橫桿','輔助桿']:
  length=float(re.search(r'長 ([0-9.]+) m',item['spec'])[1]);code={'主架':'V61','橫桿':'H66','輔助桿':'V62'}[name]+f'{round(length*100):03d}'
 elif name=='平主架':
  code='V60100';item['spec']='長 1.0 m；Ø60.2 × t3.2 mm；未加裝方管連接棒';item['note']='依使用者指定 V60 系列，以主架長度分列。'
 elif name=='斜桿':
  w,h=map(float,re.search(r'([0-9.]+) m × ([0-9.]+) m',item['spec']).groups());code=f'D6{round(w*10):02d}{round(h*10):02d}'
 if code:item.update(code=code,codeSource='user')
 items.append(item)
 if name=='下調整座':
  for code,label in [('J48601S','活動下調整座'),('U48601S','活動上調整座')]:items.append(dict(id='user-'+code,code=code,name=label,spec='活動式；長度、牙管與活動角度規格請補填',weight='',page=None,category='主架與基座',officialCode=False,codeSource='user',note='使用者補充品號；不套用固定式尺寸與單重。'))
 if name=='平主架':
  for length in [1.5,2.0,3.0]:
   other=copy.deepcopy(item);other.update(id=f'sucoot-flat-{round(length*100):03d}',code=f'V60{round(length*100):03d}',spec=f'長 {length:.1f} m；Ø60.2 × t3.2 mm；未加裝方管連接棒');items.append(other)
removed={'組合插銷','扳手','彈簧銷','墊圈套座','套座用固定勾','HN-15ET墊圈','超重型調整座','轉折平台'}
retired=[r['id'] for r in items if r['name'] in removed or (r['name']=='定位桿' and not r['spec'].startswith(('1.8 m × 1.5 m','2.4 m × 1.5 m')))]
final=[r for r in items if r['id'] not in retired]
for item in final:
 if item['name']=='定位桿':item.update(code='L61815' if item['spec'].startswith('1.8') else 'L62415',codeSource='user')
assert len(final)==66 and len({r['code'] for r in final})==66
v1='sucoot-7527-2025-11-v1';v2='sucoot-7527-2025-11-v2'
data=dict(version='sucoot-7527-2025-11-v3',source='7527.pdf',edition='2025/11',items=final,retiredIds=retired,previousVersions=[v1,v2],previousDefaults={r['id']:{'code':r['code'],'spec':r['spec']} for r in previous},previousItemIds={v1:[r['id'] for r in previous],v2:[r['id'] for r in items]})
data=merge_pdf_catalog(data,root)
(root/'catalog.js').write_text("'use strict';\nwindow.SUCOOT_CATALOG = "+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf8')
notes='''# 型錄與品號對照\n\n來源：使用者上傳 `7527.pdf`，封底 2025/11，共 48 頁。頁碼採型錄印刷頁碼（印刷頁碼加 2 即為實際 PDF 頁碼）。\n\n- V60、V61、H66、D6、L6、上下調整座、活動上下調整座、基座與輔助桿品號依使用者指定。D6 先橫向後高度，以分米各補兩碼。主架、平主架、橫桿以公分補三碼。\n- 自編碼是表單識別碼，不是官方品號。未載單重不推估。\n- 48 kg 僅為 P.27 單組爬梯踏板約重，不套用至整體爬梯配置；16.53 kg 僅為 P.30 含螺絲與扶手的鋁製爬梯整組。\n- 雙C梁架採 P.21 總長 1.65 m，900 mm 圖示不視為總長。\n- H66120 等 P.32 圖中標註不套用為腳踏板／蓋板品號。\n- 依使用者要求，定位桿僅保留 L61815、L62415，移除八類不需預列的零件。\n- 此次因工作區還原造成未提交檔案遺失，依對話中已確認內容重建。\n\n| 品號 | 名稱 | 規格 | 單重 kg | 來源頁 |\n| --- | --- | --- | --- | --- |\n'''
for item in final:notes+='| '+' | '.join([item['code'],item['name'],item['spec'],item['weight'] or '未載',str(item['page']) if item['page'] else '使用者補充'])+' |\n'
notes+='\n## 新增重量表來源\n\n產品列來源：《綜合版-重量計算表20221013(增新超重支撐模組).pdf》，16頁334列。No.300沒有產品識別資料，未建立虛構產品。\n\n已將原有66項與重量表逐列核對：合併43列、新增290項，共356項。先依PDF列次排出333項，其餘23項既有資料置後。不同或相似不確定資料標紅保留供人工刪除；編號以PDF為準，空白單重不推估，原有非空白單重差異不覆蓋。\n\n完整逐列對照見 [核對報告](../reports/pdf-merge.html)；可重建的純產品來源資料為 `weight-pdf-20221013.json`。\n'
(root/'catalog/SOURCES.md').write_text(notes,encoding='utf8')
print('Built',len(data['items']),'catalogue items in PDF order')

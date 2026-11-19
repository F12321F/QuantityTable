"""Merge source PDF rows without fabricating codes or missing weights."""
import copy,csv,html,json,re,unicodedata
from pathlib import Path

PDF_NAME='綜合版-重量計算表20221013(增新超重支撐模組).pdf'
def normalized(value):
 value=unicodedata.normalize('NFKC',value).lower().replace('樑','梁')
 return re.sub(r'\s+','',value).replace('∅','ø').replace('φ','ø')
def flat(value):return re.sub(r'\s*\n\s*','',value).strip()
def valid_code(value):return bool(re.fullmatch(r'[A-Za-z][A-Za-z0-9()\-]*(?:\(1版\))?',value))
def pdf_category(number):
 if number<=11 or 32<=number<=36 or number in (46,47):return '主架與基座'
 if 12<=number<=31:return '橫桿、斜桿與定位桿'
 if 37<=number<=42 or number==45 or number in (333,334):return '爬梯與護欄'
 if 48<=number<=58:return '腳踏板與蓋板'
 if 59<=number<=100 or 159<=number<=171:return '鋼梁、蜂巢鋼與木梁'
 if 101<=number<=129:return '三角背撐與斜撐'
 if 172<=number<=177:return '超重支撐模組配件'
 if 178<=number<=200:return '施工平台與配件'
 if 201<=number<=264:return '螺桿與預埋件'
 return '梁架與配件'
def dimensions_match(old,new):
 """Check explicit dimensions, not the code's digit pattern alone."""
 a,b=old['spec'],new['spec'];name=old['name']
 if name in ('主架','平主架','橫桿','輔助桿','標準基座'):
  length=re.search(r'長 ([\d.]+) (mm|m)',a)
  pdf_length=re.search(r'([\d.]+)m$',b)
  if not length or not pdf_length:return False
  a_len=float(length[1])*(1 if length[2]=='mm' else 1000)
  b_len=float(pdf_length[1])*1000
  diam,thickness=(48.6,2.3) if name=='橫桿' else (60.2,3.2)
  return a_len==b_len and all(str(v) in a and str(v) in b for v in (diam,thickness))
 if name in ('斜桿','定位桿'):
  p=re.search(r'([\d.]+) m × ([\d.]+) m',a)
  q=re.search(r'([\d.]+) × ([\d.]+)m$',b)
  return bool(p and q and tuple(map(float,p.groups()))==tuple(map(float,q.groups())) and '48.6' in b and '2.3' in b)
 if old['code'] in ('J48601','U48601'):
  return list(map(float,re.findall(r'\d+(?:\.\d+)?',a)))[:3]==list(map(float,re.findall(r'\d+(?:\.\d+)?',b)))[:3]
 return normalized(a)==normalized(b) and normalized(old['name'])==normalized(new['name'])

def merge_pdf_catalog(data,root):
 original=copy.deepcopy(data['items']);original_by_id={p['id']:p for p in original}
 by_code={p['code']:p for p in original if not p['code'].startswith('自編-')}
 raw=json.loads((root/'catalog/weight-pdf-20221013.json').read_text(encoding='utf8'))
 assert len(raw)==334 and [r['no'] for r in raw]==list(range(1,335))
 items={p['id']:copy.deepcopy(p) for p in original};audit=[];rules={};source_ids=[]
 # Exact dimensions and purpose, with a visible review note where the old
 # catalogue omitted information or used another product label/code.
 explicit={34:'user-J48601S',35:'user-U48601S',36:'sucoot-202511-012',41:'sucoot-202511-039',
  50:'sucoot-202511-052',51:'sucoot-202511-053',52:'sucoot-202511-054',53:'sucoot-202511-055',54:'sucoot-202511-056',55:'sucoot-202511-057',
  56:'sucoot-202511-058',57:'sucoot-202511-059',58:'sucoot-202511-060'}
 related={43:['sucoot-202511-035'],44:['sucoot-202511-009'],45:['sucoot-202511-047'],
  37:['sucoot-202511-043','sucoot-202511-045','sucoot-202511-046'],38:['sucoot-202511-044','sucoot-202511-045'],
  267:['sucoot-202511-063'],268:['sucoot-202511-062'],333:['sucoot-202511-049'],334:['sucoot-202511-048'],
  175:['sucoot-202511-071'],**{n:['sucoot-202511-067'] for n in range(130,138)}}
 for source in raw:
  r={**source,'code':flat(source['code']),'name':flat(source['name']),'spec':flat(source['spec'])}
  if r['no'] in (333,334):r['name']='C型主架座'
  r['rawCode']=r['code'];r['label']='';r['notes']=[];r['targetId']='';r['before']=None
  if r['code'] and not valid_code(r['code']):
   r['label']=r['code'];r['code']='';r['notes'].append('編號欄原文「'+r['label']+'」為說明／版本，產品編號留白。')
  if not r['name']:
   r['action']='待補：空白列未加入';audit.append(r);continue
  no=r['no'];target=None;review=[]
  if no in explicit:
   target=original_by_id[explicit[no]]
   if 50<=no<=55:
    width,length=map(int,re.findall(r'\d+',r['spec']))
    assert f'長 {length} mm' in target['spec'] and f'寬 {width} mm' in target['spec']
   if no==36:assert '0.35 m' in target['spec'] and '60.2' in r['spec'] and '0.35m' in r['spec']
   if no in (34,35):review.append('舊編號 '+target['code']+' 與 PDF '+r['code']+' 不同；編號以 PDF 為準，活動式規格請人工核對。')
   if no==41:review.append('舊品名「插銷」、規格未列；PDF 為「哲管 4吋」，保留原資料於核對報告，請人工核對。')
   if no in (56,57,58):review.append('舊表未標示表面處理，PDF 為熱浸；依 PDF 補列並標紅待核對。')
  elif r['code'] in by_code:
   candidate=by_code[r['code']]
   if dimensions_match(candidate,r):target=candidate
   else:review.append('與既有同編號項目之規格不同，分列保留供人工刪除。')
  if no in (94,95):review.append('PDF 的 DB100812 同時用於1.2m與1.5m；不改造編號，兩種規格分列。')
  if no in (151,155):review.append('PDF 的 H7-B20160T-5 對應不同品名／規格；分列，請核對。')
  if no in (103,104,109,110):review.append('PDF 存在同品名同規格但不同版本及重量；各列依原文保留。')
  for legacy_id in related.get(no,[]):
   warning='與 PDF No.'+str(no)+' 相似或規格／重量範圍不同；舊品項保留在 PDF 清單後方，可人工刪除。'
   items[legacy_id].setdefault('reviewNotes',[])
   if warning not in items[legacy_id]['reviewNotes']:items[legacy_id]['reviewNotes'].append(warning)
   review.append('與原有「'+original_by_id[legacy_id]['name']+'／'+original_by_id[legacy_id]['spec']+'」相似或不確定；兩者保留並標紅，可人工刪除。')
  if target:
   p=items[target['id']];before={k:target[k] for k in ('code','name','spec','weight')};r['before']=before
   r['action']='重複合併／補空白';r['targetId']=p['id']
   p.update(code=r['code'],name=r['name'],spec=r['spec'])
   if not p['weight'] and r['weight']!='':p['weight']=r['weight']
   elif r['weight']!='' and float(p['weight'])!=float(r['weight']):review.append('既有單重 '+p['weight']+' 與 PDF '+r['weight']+' 不同，保留原值。')
   rules[p['id']]={'before':before,'after':{k:p[k] for k in before},'pdfNo':no,'pdfPage':r['page']}
  else:
   r['action']='新增';p=dict(id=f'weight-pdf-20221013-{no:03d}',code=r['code'],name=r['name'],spec=r['spec'],weight=r['weight'],page=r['page'],
    category=pdf_category(no),officialCode=bool(r['code']),codeSource='pdf',note='')
   items[p['id']]=p;r['targetId']=p['id']
  p.update(pdfNo=no,pdfPage=r['page'],pdfCodeLabel=r['label'],pdfWeight=r['weight'],pdfSpec=r['spec'],pdfName=r['name'],
   pdfCode=r['code'],sourceType='weight-pdf',reviewNotes=review,note='；'.join(r['notes']+review))
  r['notes']+=review;source_ids.append(p['id']);audit.append(r)
 assert len(source_ids)==333 and len(set(source_ids))==333
 source_set=set(source_ids)
 ordered=[items[key] for key in source_ids]+[items[p['id']] for p in original if p['id'] not in source_set]
 # PDF order is explicit and independent of IDs, codes, categories or browser
 # storage order. Extra existing rows follow all numbered PDF products.
 for i,p in enumerate(ordered):p['displayOrder']=i
 old_version=data['version'];data['previousVersions'].append(old_version)
 data['previousItemIds'][old_version]=[p['id'] for p in original]
 data.update(version='sucoot-weight-pdf-20221013-v4',items=ordered,pdfRules=rules,
  weightPdf={'name':PDF_NAME,'pages':16,'rowCount':334,'audit':audit,'sourceIds':source_ids,
   'summary':{'original':66,'new':sum(r['action']=='新增' for r in audit),'merged':len(rules),'total':len(ordered),'blankRows':[300]}})
 assert len(ordered)==356 and len(rules)==43
 report_dir=root/'reports';report_dir.mkdir(exist_ok=True)
 headers=['PDF頁','PDF項次','PDF編號原文','產品編號','品名','規格','單重kg','處理','既有編號','既有品名','既有規格','既有單重','差異及備註']
 def csv_rows(records):
  result=[headers]
  for r in records:
   old=r['before'] or {};result.append([r['page'],r['no'],r['rawCode'],r['code'],r['name'],r['spec'],r['weight'],r['action'],old.get('code',''),old.get('name',''),old.get('spec',''),old.get('weight',''),'；'.join(r['notes'])])
  return result
 for filename,records in [('all',audit),('added',[r for r in audit if r['action']=='新增']),('duplicates',[r for r in audit if r['before']]),
   ('missing',[r for r in audit if not r['code'] or not r['weight'] or not r['name']]),('differences',[r for r in audit if r['notes'] and (r['targetId'] and items[r['targetId']].get('reviewNotes'))])]:
  with (report_dir/f'pdf-{filename}.csv').open('w',encoding='utf-8-sig',newline='') as f:csv.writer(f).writerows(csv_rows(records))
 e=lambda v:html.escape(str(v))
 table='<table><tr>'+''.join('<th>'+e(v)+'</th>' for v in headers)+'</tr>'+''.join('<tr'+(' class="red"' if r['targetId'] and items[r['targetId']].get('reviewNotes') else '')+'>'+''.join('<td>'+e(v)+'</td>' for v in row)+'</tr>' for r,row in zip(audit,csv_rows(audit)[1:]))+'</table>'
 (report_dir/'pdf-merge.html').write_text('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PDF品項核對報告</title><style>body{font-family:"Microsoft JhengHei",sans-serif;padding:24px;color:#213d37;line-height:1.7}table{border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:7px;vertical-align:top;min-width:80px}.red{color:#b42318}.scroll{overflow:auto}</style><h1>PDF品項核對報告</h1><p>16頁334列：原有66項保留，合併43列，新增290項，共356項。依PDF列次排列；PDF未列的既有項目留在後方。第300列沒有品名，不加入虛構產品。</p><p>紅字是不同或相似而不確定的資料，保留供使用者手動刪除。編碼以PDF為準；空白單重不推估，原有非空白單重衝突先保留。客戶、工程、業務及製表人預設空白，不含預設工程或人名。</p><p>'+ ' · '.join(f'<a href="pdf-{n}.csv">{label}</a>' for n,label in [('all','全部334列'),('added','新增'),('duplicates','重複'),('missing','待補'),('differences','差異')])+'</p><div class="scroll">'+table+'</div></html>',encoding='utf8')
 return data

import json, re, os

RAW_DIR = r"C:\Users\ASUS\Documents\拖延症解决应用\server\assets\教材库\计算机系统结构\raw_texts"
QA_PATH = r"C:\Users\ASUS\Documents\拖延症解决应用\server\data\textbook_qa_all.json"
BOOK = "计算机组成原理"
BOOK_ABBR = "co"

with open(QA_PATH, "r", encoding="utf-8") as f:
    qa_all = json.load(f)

# 先删除所有计组旧条目
old_count = len(qa_all)
qa_all = [e for e in qa_all if e["book"] != BOOK]
print(f"已删除 {old_count - len(qa_all)} 条旧计组, 剩余 {len(qa_all)} 条")

def pad_no(n): return f"{int(n):02d}"
def infer_type(t): return "选择题" if re.search(r"[A-D][.、)\s]", t) else "综合题"

new = []

for fname in sorted(os.listdir(RAW_DIR)):
    if not fname.endswith(".txt"): continue
    with open(os.path.join(RAW_DIR, fname), "r", encoding="utf-8") as f:
        lines = f.read().replace("\r\n", "\n").replace("\r", "\n")
    ch = re.search(r"第(\d+)章", fname).group(1)

    sec_titles = [(m.start(), m.group(1))
        for m in re.finditer(r"^(\d+\.\d+\.\d+)\s", lines, re.MULTILINE)]

    questions = {}
    answers   = {}
    q_sections = []
    a_sections = []

    for i, (pos, sec) in enumerate(sec_titles):
        line_end = lines.find("\n", pos)
        title_line = lines[lines.rfind("\n", 0, pos)+1:line_end]
        next_pos = sec_titles[i+1][0] if i+1 < len(sec_titles) else len(lines)
        body = lines[line_end+1:next_pos].strip()

        if "习题精选" in title_line:
            q_sections.append(sec)
            for part in re.split(r"\n(?=\s*\d{1,2}\.\s)", body):
                m = re.match(r"\s*(\d{1,2})\.\s+(.*)", part, re.DOTALL)
                if not m: continue
                qno, qt = pad_no(m.group(1)), m.group(2).strip()
                if len(qt) >= 5:
                    questions.setdefault(sec, []).append((qno, qt))

        elif "答案与解析" in title_line:
            a_sections.append(sec)
            for part in re.split(r"\n(?=\s*\d{1,2}\s*\.\s)", body):
                m = re.match(r"\s*(\d{1,2})\s*\.\s*([A-E]?)\s*\n?(.*)", part, re.DOTALL)
                if not m: continue
                ano = pad_no(m.group(1))
                atext = (m.group(2) + "\n" + m.group(3).strip()).strip()
                answers.setdefault(sec, []).append((ano, atext))

    added = 0
    for q_sec in q_sections:
        def section_key(s):
            return tuple(int(x) for x in s.split("."))
        ans_sec = next((a for a in a_sections if section_key(a) > section_key(q_sec)), None)
        alist = answers.get(ans_sec, []) if ans_sec else []
        for qno, qt in questions.get(q_sec, []):
            eid = f"{BOOK_ABBR}_{ch}_{q_sec.replace('.','_')}_{qno}"
            ans = next((a for a in alist if a[0] == qno), None)
            new.append({
                "id": eid, "book": BOOK, "chapter": ch, "section": q_sec,
                "questionNo": qno, "questionText": qt,
                "answerText": ans[1] if ans else "",
                "type": infer_type(qt),
            })
            added += 1
    print(f"  {fname}: {added} 题")

qa_all.extend(new)
with open(QA_PATH, "w", encoding="utf-8") as f:
    json.dump(qa_all, f, ensure_ascii=False, indent=2)
print(f"\n计组题库: {len(new)} 题 | 题库总计: {len(qa_all)} 条")
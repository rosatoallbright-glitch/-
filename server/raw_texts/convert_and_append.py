import json, re, os

# ===== 配置 =====
SRC = r"C:\Users\ASUS\Documents\拖延症解决应用\server\assets\教材库\计算机系统结构\results_qa.json"
QA_PATH = r"C:\Users\ASUS\Documents\拖延症解决应用\server\data\textbook_qa_all.json"

# ===== 工具函数 =====
def extract_section(text: str) -> str:
    m = re.search(r"(\d+\.\d+(?:\.\d+)?)", text)
    return m.group(1) if m else ""

def extract_question_no(raw: str) -> str:
    n = int(re.sub(r"\D", "", raw) or "0")
    return f"{n:02d}"

def chapter_num(raw: str) -> str:
    return re.sub(r"\D", "", raw) or "0"

def infer_type(text: str, options: dict) -> str:
    if options and len(options) > 0:
        return "选择题"
    if re.search(r"[A-D][.、)\s]", text):
        return "选择题"
    return "综合题"

book_abbr = {"计算机组成原理": "co", "数据结构": "ds", "操作系统": "os", "计算机网络": "cn"}

# ===== 加载原始题库 =====
if os.path.exists(QA_PATH):
    with open(QA_PATH, "r", encoding="utf-8") as f:
        qa_all = json.load(f)
    print(f"已加载题库: {len(qa_all)} 条")
else:
    qa_all = []
    print("题库文件不存在, 将创建新文件")

# ===== 加载并转换新数据 =====
with open(SRC, "r", encoding="utf-8") as f:
    src = json.load(f)
print(f"待转换: {len(src)} 条")

converted = []
skipped = 0
for item in src:
    ch = chapter_num(item["chapter"])
    qno = extract_question_no(item["question_number"])
    sec = extract_section(item["question"])
    if not sec:
        sec = f"{ch}.0.0"  # 无法提取 section 时占位
        skipped += 1
    abbr = book_abbr.get(item["book"], "xx")
    eid = f"{abbr}_{ch}_{sec.replace('.', '_')}_{qno}"

    answer_text = item["answer"]
    if item.get("explanation"):
        answer_text += "\n" + item["explanation"]

    converted.append({
        "id": eid,
        "book": item["book"],
        "chapter": ch,
        "section": sec,
        "questionNo": qno,
        "questionText": item["question"],
        "answerText": answer_text,
        "type": infer_type(item["question"], item.get("options", {})),
    })

# ===== 去重后追加 =====
existing_ids = {e["id"] for e in qa_all}
new_entries = [e for e in converted if e["id"] not in existing_ids]
dup_count = len(converted) - len(new_entries)

qa_all.extend(new_entries)

# ===== 写回 =====
with open(QA_PATH, "w", encoding="utf-8") as f:
    json.dump(qa_all, f, ensure_ascii=False, indent=2)

print(f"转换完成: {len(converted)} 条")
print(f"  无法提取section: {skipped} 条 (使用 {ch}.0.0 占位)")
print(f"  重复跳过: {dup_count} 条")
print(f"  新增: {len(new_entries)} 条")
print(f"  题库总计: {len(qa_all)} 条")
print(f"  → {QA_PATH}")
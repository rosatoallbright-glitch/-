import sqlite3, json, time, os
db = r'C:\Users\ASUS\AppData\Roaming\anythingllm-desktop\storage\anythingllm.db'
conn = sqlite3.connect(db)
c = conn.cursor()

# Clear old records
c.execute("DELETE FROM workspace_documents")
c.execute("DELETE FROM workspace_parsed_files")
c.execute("DELETE FROM document_vectors")
conn.commit()
print("Cleared old records")

# Create direct-uploads JSON
text = open(r'C:\Users\ASUS\Documents\拖延症解决应用\2027数据结构_教材.txt', encoding='utf-8').read()
doc_id = "textbook_" + str(int(time.time()))
direct = r'C:\Users\ASUS\AppData\Roaming\anythingllm-desktop\storage\direct-uploads'
jpath = os.path.join(direct, "2027dadaojiegou-" + doc_id + ".json")

data = {
    "id": doc_id,
    "title": "2027数据结构教材.txt",
    "docAuthor": "no author found",
    "description": "王道考研数据结构教材",
    "docSource": "local file upload",
    "chunkSource": "localfile://...",
    "published": time.strftime("%Y/%m/%d %H:%M:%S"),
    "wordCount": len(text),
    "pageContent": text,
    "token_count_estimate": len(text) // 4
}

with open(jpath, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
print(f"Created JSON: {jpath} size={os.path.getsize(jpath)} bytes")
conn.close()

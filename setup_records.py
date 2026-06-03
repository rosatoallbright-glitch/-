import sqlite3, json, time, os
db_path = r"C:\Users\ASUS\AppData\Roaming\anythingllm-desktop\storage\anythingllm.db"
direct = r"C:\Users\ASUS\AppData\Roaming\anythingllm-desktop\storage\direct-uploads"

conn = sqlite3.connect(db_path)
c = conn.cursor()

# Find the latest direct-uploads JSON for our textbook
jfile = None
for f in os.listdir(direct):
    if "dadaojiegou" in f:
        jfile = os.path.join(direct, f)
        break

if jfile:
    with open(jfile, "r", encoding="utf-8") as fh:
        doc_data = json.load(fh)
    
    doc_id = doc_data["id"]
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
    
    # Add to workspace_parsed_files with proper metadata including pageContent
    meta = json.dumps(doc_data, ensure_ascii=False)
    meta_with_location = json.dumps({**doc_data, "location": jfile}, ensure_ascii=False)
    
    c.execute("SELECT COALESCE(MAX(id),0) FROM workspace_parsed_files")
    pf_id = c.fetchone()[0] + 1
    
    c.execute("""INSERT INTO workspace_parsed_files (id, filename, workspaceId, metadata, tokenCountEstimate, createdAt)
                 VALUES (?, ?, 3, ?, ?, ?)""",
              (pf_id, "2027数据结构_教材.txt", meta_with_location, doc_data["token_count_estimate"], now))
    
    # Add to workspace_documents
    c.execute("SELECT COALESCE(MAX(id),0) FROM workspace_documents")
    wd_id = c.fetchone()[0] + 1
    
    c.execute("""INSERT INTO workspace_documents (id, docId, filename, docpath, workspaceId, metadata, createdAt, lastUpdatedAt, pinned, watched)
                 VALUES (?, ?, ?, ?, 3, ?, ?, ?, 0, 0)""",
              (wd_id, doc_id, "2027数据结构_教材.txt", "documents/2027数据结构_教材.txt", json.dumps({"id": doc_id}), now, now))
    
    conn.commit()
    print(f"Created parsed_files id={pf_id}, workspace_documents id={wd_id}")
    print(f"doc_id={doc_id}")
    print(f"pageContent length: {len(doc_data.get('pageContent', ''))} chars")
    print(f"token_estimate: {doc_data['token_count_estimate']}")
else:
    print("No JSON file found")

conn.close()

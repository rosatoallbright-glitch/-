import sqlite3
db_path = r"C:\Users\ASUS\AppData\Roaming\anythingllm-desktop\storage\anythingllm.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()
for tbl in ["workspace_documents", "document_vectors", "workspace_parsed_files"]:
    c.execute("PRAGMA table_info(" + tbl + ")")
    cols = [(r[1], r[2]) for r in c.fetchall()]
    print(tbl + ":", cols)
conn.close()

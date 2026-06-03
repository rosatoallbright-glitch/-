import re
with open("C:\\Users\\ASUS\\Documents\\拖延症解决应用\\src\\components\\LuluChat.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove isALM blocks (AnythingLLM workspace slug UI)
content = re.sub(r"\s*\{\s*isALM && \(\s*<div[\s\S]*?工作区[\s\S]*?</div>\s*\)\s*}", "", content)

# Fix placeholder
content = content.replace('placeholder={isALM ? "向 AnythingLLM 工作区" + workspaceSlug + "提问..." : "输入你的问题..."}', 'placeholder="输入你的问题..."')

# Fix footer text
content = re.sub(r'<p className="text-\[10px\].*?font-mono text-center">[\s\S]*?</p>', '<p className="text-[10px] text-zinc-600 mt-2 font-mono text-center">Enter 发送 · Shift+Enter 换行</p>', content)

# Remove PDF note
content = content.replace('<p className="text-[10px] text-zinc-600 mt-2 font-mono">PDF 文件请通过 AnythingLLM 上传到工作区后，在下方填写工作区标识。</p>', "")

with open("C:\\Users\\ASUS\\Documents\\拖延症解决应用\\src\\components\\LuluChat.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Cleaned")

import os
import re

# 配置输入和输出目录
INPUT_DIR = 'raw_texts'
OUTPUT_DIR = 'cleaned_texts'

def get_new_filename(old_name):
    """根据文件名自动识别并生成规范的输出文件名"""
    # 提取科目
    subject = "未分类"
    if re.search(r'数据结构', old_name):
        subject = "数据结构"
    elif re.search(r'组成|计组', old_name):
        subject = "计组"
    elif re.search(r'操作系统|os', re.IGNORECASE, old_name):
        subject = "操作系统"
    elif re.search(r'计算机网络|网', old_name):
        subject = "计算机网络"
        
    # 提取章节号和章节名 (假设原文件名格式类似于 "2027计算机组成原理_第1章_计算机系统概述_...")
    match = re.search(r'(第\d+章)_([^_\.]+)', old_name)
    if match:
        chapter_num = match.group(1)
        chapter_name = match.group(2)
        return f"{subject}_{chapter_num}_{chapter_name}.txt"
    return f"{subject}_已清洗_{old_name}"

def clean_text(text):
    lines = text.split('\n')
    cleaned_lines = []
    
    skip_mode = False # 是否处于“试题”或“答案”删除区块中
    
    for line in lines:
        stripped_line = line.strip()
        
        # 1. 检查是否需要退出删除模式 (遇到新的小节标题如 1.1 或 1.1.1)
        if skip_mode:
            # 匹配 1.1 标题形式，要求以数字和点开头，后面跟着空格和文字
            if re.match(r'^\d+\.\d+(?:\.\d+)?\s+[\u4e00-\u9fa5a-zA-Z]', stripped_line) or re.match(r'^\d+\.\d+$', stripped_line):
                skip_mode = False
            else:
                continue # 继续丢弃
                
        # 2. 检查是否进入删除模式
        if re.search(r'试题精选|答案与解析', stripped_line):
            skip_mode = True
            continue
            
        # 3. 行级必须删除的内容
        # 选项标题
        if re.search(r'[一二]\s*、\s*(单项选择题|综合应用题)', stripped_line):
            continue
        # 真题标记
        if '【20' in stripped_line and '统考真题】' in stripped_line:
            stripped_line = re.sub(r'【20\d{2}统考真题】', '', stripped_line).strip()
        if '【解答】' in stripped_line:
            continue
        # 孤立选项片段 (如 A. 顺序表)
        if re.match(r'^[A-D][\.、\)]\s+', stripped_line):
            continue
        # 答案编号行 (如 01. B)
        if re.match(r'^\d+\.\s*[A-D]\s*$', stripped_line):
            continue
        # PDF 残留（纯数字页码或极短的无意义字符）
        if re.match(r'^\d+$', stripped_line):
            continue
        # 删除疑似题目的行 (XX. 下列选项中...)
        if re.match(r'^\d{1,3}\.\s*(下列|关于|对于|图示|假设|已知|在)', stripped_line):
            continue
            
        # 如果整行被清空了，则跳过（保留原有的空行逻辑）
        if not stripped_line and not line:
            cleaned_lines.append("")
            continue
            
        # 4. 格式规范替换
        # 禁止数字编号，将首部的 1. 2. ① 01. 改成 - 
        # (排除形如 1.1 的章节号，所以只匹配 1. / 01. 或圆圈数字)
        processed_line = re.sub(r'^(\d{1,3}\.|[①-⑳])\s+', '- ', stripped_line)
        
        if processed_line:
            cleaned_lines.append(processed_line)
            
    # 合并文本
    joined_text = '\n'.join(cleaned_lines)
    
    # 5. 空行压缩：连续3个以上空行压缩为恰好2个空行（即\n\n\n，分隔出两个空白行）
    joined_text = re.sub(r'\n{4,}', '\n\n\n', joined_text)
    
    return joined_text

def validate_cleaning(text, filename):
    """验收标准：正则扫描以下词汇，出现次数应极少或为0"""
    patterns = [
        r'试题精选', r'单项选择题', r'综合应用题', 
        r'答案与解析', r'【解答】', r'【20\d{2}统考真题】'
    ]
    print(f"\n--- 验证报告: {filename} ---")
    for p in patterns:
        matches = len(re.findall(p, text))
        if matches > 0:
            print(f"⚠️ 警告: 发现保留了 {matches} 处 '{p}'")
        else:
            print(f"✅ 完美: 未发现 '{p}'")

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    for filename in os.listdir(INPUT_DIR):
        if not filename.endswith('.txt'):
            continue
            
        filepath = os.path.join(INPUT_DIR, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        cleaned_content = clean_text(content)
        new_filename = get_new_filename(filename)
        out_filepath = os.path.join(OUTPUT_DIR, new_filename)
        
        with open(out_filepath, 'w', encoding='utf-8') as f:
            f.write(cleaned_content)
            
        print(f"处理完成: {filename} -> {new_filename}")
        validate_cleaning(cleaned_content, new_filename)

if __name__ == "__main__":
    main()
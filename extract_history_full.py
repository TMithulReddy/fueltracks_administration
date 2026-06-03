import json

log_file = r"C:\Users\mithu\.gemini\antigravity\brain\90564915-ec0d-443d-b01c-5bb2a51de799\.system_generated\logs\transcript.jsonl"

best_len = 0
best_content = ""
best_step = -1

def check(val, step_idx):
    global best_len, best_content, best_step
    if isinstance(val, str) and "export default function EmployeeDetail" in val:
        if len(val) > best_len:
            best_len = len(val)
            best_content = val
            best_step = step_idx
    elif isinstance(val, dict):
        for k, v in val.items():
            check(v, step_idx)
    elif isinstance(val, list):
        for item in val:
            check(item, step_idx)

with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            check(data, data.get('step_index'))
        except Exception as e:
            pass

print(f"Best match in Step {best_step} with length {best_len}")
if best_content:
    with open("recovered_detail.txt", "w", encoding="utf-8") as out:
        out.write(best_content)
    print("Wrote to recovered_detail.txt")

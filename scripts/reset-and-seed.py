"""Reset and re-seed the todolist database via API."""
import json
import urllib.request

BASE = "http://localhost:3000"

# 1. Get all tasks (including deleted)
resp = urllib.request.urlopen(f"{BASE}/api/tasks?includeDeleted=1")
data = json.loads(resp.read())
tasks = data.get("tasks", [])
print(f"Found {len(tasks)} tasks to delete")

# 2. Permanently delete each
for t in tasks:
    req = urllib.request.Request(
        f"{BASE}/api/tasks/{t['id']}?permanent=1", method="DELETE"
    )
    try:
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"  Failed to delete {t['title']}: {e}")

# 3. Also empty trash
try:
    req = urllib.request.Request(f"{BASE}/api/tasks/trash", method="DELETE")
    urllib.request.urlopen(req)
except Exception:
    pass

# 4. Re-seed
req = urllib.request.Request(f"{BASE}/api/tasks/seed", method="POST")
resp = urllib.request.urlopen(req)
result = json.loads(resp.read())
print(f"Seed result: {result}")

# 5. Verify notes
resp = urllib.request.urlopen(f"{BASE}/api/tasks")
data = json.loads(resp.read())
tasks = data.get("tasks", [])
print(f"\nNow {len(tasks)} tasks. Tasks with notes:")
for t in tasks:
    if t.get("noteMarkdown"):
        print(f"  + {t['title']}: {t['noteMarkdown'][:60]}...")

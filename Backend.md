# FocusFlow Backend (Django + DRF)

## Overview
This backend powers a Pomodoro-style focus timer application.  
It handles session tracking, preset management, and productivity statistics.  
Built as an MVP with clean extensibility.

---

## Tech Stack
- Django
- Django REST Framework
- django-cors-headers

---

## Models

### Session
Tracks each focus session.

Fields:
- work_duration (int)
- break_duration (int)
- completed (bool)
- timestamp (auto)

---

### Preset
Stores reusable timer configurations.

Fields:
- name (string)
- work_duration (int)
- short_break (int)
- long_break (int)

---

## API Endpoints

### Session
- POST `/api/start-session/` → create session
- POST `/api/end-session/` → complete session

### Stats
- GET `/api/stats/` → total focus + session count

### Presets
- POST `/api/save-preset/` → create preset
- GET `/api/presets/` → list presets
- DELETE `/api/delete-preset/<id>/` → delete preset

---

## Business Logic

- Session lifecycle: start → end
- Only completed sessions counted in stats
- Presets store reusable timer configs

---

## Custom Logic

```python
def calculate_short_break(work_duration):
    return 5 + 0.2 * (work_duration - 25)

def calculate_long_break(pomodoros_completed):
    return 15 + 5 * (pomodoros_completed - 4)
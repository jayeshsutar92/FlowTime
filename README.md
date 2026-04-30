# FlowTime

FlowTime is a full-stack productivity application built to help users focus, track sessions, and improve consistency through structured work cycles and analytics.

---

## Overview

FlowTime combines a clean timer experience with intelligent insights. It supports customizable sessions, real-time tracking, and a simple dashboard to visualize progress.

The application follows a minimal, distraction-free design while still offering meaningful data to improve productivity.

---

## Features

### Core Functionality

* Default focus timer (Pomodoro-style)
* Custom session builder (work, short break, long break)
* Session tracking with persistence
* Start, pause, reset controls

### Smart Features

* Adaptive break handling based on backend logic
* Productivity score (0–100) with level indicators
* Focus insights:

  * Average focus time
  * Completion rate
  * Best focus time slot
  * Recommendations

### Dashboard

* Total focus time
* Total sessions
* Productivity score
* Focus insights cards
* 7-day session heatmap

### Authentication

* User signup
* Login with password
* Login with OTP
* Forgot and reset password flow

### UI/UX

* Clean landing page
* Dark mode support
* Responsive layout
* Minimal and fast interface

---

## Tech Stack

### Frontend

* React (Vite)
* Tailwind CSS

### Backend

* Django
* Django REST Framework

### Database

* SQLite (development)

---

## Project Structure

FlowTime/
├── backend/
│   ├── config/
│   ├── focusapp/
│   └── manage.py
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
└── README.md

---

## Requirements

### General

* Node.js (v16 or higher)
* Python (3.8 or higher)
* Git

### Backend

* Django
* djangorestframework

### Frontend

* npm or yarn

---

## Installation and Setup

### 1. Clone Repository

git clone https://github.com/akajayesh/FlowTime.git
cd FlowTime

---

## Backend Setup

### Windows

cd backend
python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt

python manage.py migrate
python manage.py runserver

---

### macOS / Linux

cd backend
python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

python manage.py migrate
python manage.py runserver

---

## Frontend Setup

### Windows / macOS / Linux

cd frontend
npm install
npm run dev

---

## Running the Application

Backend runs on:
http://127.0.0.1:8000

Frontend runs on:
http://localhost:5173

---

## Current Status

* Core features implemented
* UI and UX polished
* Authentication working
* Dashboard analytics integrated

Testing is remaining and will be added in future updates.

---

## Future Improvements

* Unit and integration testing
* Deployment setup
* Performance optimization
* Advanced analytics
* Mobile responsiveness improvements

---

## Notes

* Do not commit .env, node_modules, or database files
* Ensure backend is running before frontend

---

## License

This project is for educational and personal use.

---

## Author

FlowTime was built as a focused SaaS-style productivity project.

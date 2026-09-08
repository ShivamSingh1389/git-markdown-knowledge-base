# Git-Backed Markdown Knowledge Base

A local-first, database-free Markdown knowledge base built with React + Node.js + Express + Git.

## Features
- Create, edit and delete Markdown notes
- Live Markdown preview
- Notes stored as normal `.md` files
- Automatic Git commit after every save
- Optional automatic Git push
- Search notes by title/content
- Git log endpoint for version history

## Requirements
- Node.js 18+
- Git installed and available in PATH
- Git configured with `user.name` and `user.email`

## Run

### 1. Backend
```bash
cd backend
npm install
npm start
```

Backend runs on `http://localhost:5000`.

### 2. Frontend
Open another terminal:
```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## Optional GitHub/GitLab backup

The project automatically initializes a local Git repository in the project root. To connect it to a remote repository:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
```

Then set:
```env
AUTO_PUSH=true
```

in `backend/.env`.

For private repositories, configure Git authentication on your machine. The application does not store GitHub passwords or tokens.

## Project structure
```text
git-markdown-knowledge-base/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       └── style.css
├── notes/
└── README.md
```

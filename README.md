# ReceiptIQ

**OCR- and AI-powered personal finance management, built with React Native.**

ReceiptIQ lets users digitize paper receipts with their phone camera, automatically extracts the text with OCR, categorizes spending, and turns it into budgets, reports, and insights — including a natural-language AI assistant for querying personal finances.

![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-SDK_52-000020?logo=expo&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)

> Developed as a Computer Engineering capstone project at Süleyman Demirel University (2025–2026).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [OCR Performance](#ocr-performance)
- [Roadmap](#roadmap)
- [Author](#author)

---

## Overview

Manually logging daily expenses is tedious, so most people simply don't do it. ReceiptIQ removes that friction: point your camera at a receipt, and the app extracts the merchant, line items, and total, classifies the spending into a category, and stores it as structured financial data you can actually analyze.

The system is a layered client–server application with a React Native mobile client, a Python/FastAPI backend, a PostgreSQL database, and a dedicated AI/ML layer for OCR, categorization, and natural-language querying.

## Features

- **Receipt scanning with OCR** — Capture a receipt with the camera and automatically extract its text. Google Cloud Vision API is the primary OCR provider, with a Tesseract OCR fallback for resilience.
- **Automatic categorization** — Expenses are sorted into 15 categories using a hybrid approach: a keyword/rule engine combined with a TF-IDF + Logistic Regression model (scikit-learn).
- **AI chat assistant** — Ask questions about your finances in natural language. Powered by semantic search over a Qdrant vector database.
- **Budget management** — Set spending limits per category and track overruns.
- **Recurring expenses** — Track subscriptions and repeating payments automatically.
- **Anomaly detection** — Statistical detection of unusual spending.
- **Weekly summary reports** — Scheduled weekly spending summaries and notifications.
- **Savings goals** — Define financial goals and monitor progress.
- **Secure accounts** — OAuth2 + JWT authentication with bcrypt-hashed passwords and refresh tokens.
- **Light & dark mode** — Consistent theming across all screens.

## Screenshots

<!-- Add real screenshots here. Drop the images in a /docs or /screenshots folder and update the paths below. -->

| Home | Receipt Scan | OCR Review | Reports |
|------|--------------|------------|---------|
| _add screenshot_ | _add screenshot_ | _add screenshot_ | _add screenshot_ |

> Tip: a short demo GIF or a 30-second video link here makes the biggest impression on visitors.

## Architecture

ReceiptIQ follows a four-layer, client–server architecture:

```mermaid
flowchart TD
    A[Mobile Client<br/>React Native + Expo] -->|REST / JWT| B[API Service<br/>Python + FastAPI]
    B --> C[(PostgreSQL<br/>relational data)]
    B --> D[AI / ML Layer]
    D --> D1[OCR<br/>Google Cloud Vision + Tesseract]
    D --> D2[Category Classifier<br/>rules + TF-IDF / Logistic Regression]
    D --> D3[AI Assistant<br/>Qdrant vector search]
```

- **Mobile client layer** — UI components, camera integration, and local state; multi-screen navigation via React Navigation (tab + stack navigators).
- **API service layer** — RESTful backend handling authentication, business logic, and validation, with async request handling.
- **Data storage layer** — PostgreSQL for relational data; Qdrant for vector representations used in semantic search.
- **AI service layer** — OCR providers, the category classifier, anomaly detection, and natural-language processing.

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Mobile** | React Native 0.76+, Expo SDK 52 (expo-camera, expo-image-picker, expo-notifications, expo-secure-store), React Navigation 6 |
| **Backend** | Python 3.11, FastAPI, async SQLAlchemy 2.0, Alembic, APScheduler |
| **Auth** | OAuth2, JWT, bcrypt |
| **Database** | PostgreSQL 16 |
| **AI / ML** | Google Cloud Vision API, Tesseract OCR 5, scikit-learn (TF-IDF, Logistic Regression), Qdrant (vector DB) |
| **Deployment** | Railway |

## Getting Started

> These are general setup steps for a React Native (Expo) + FastAPI project. Adjust paths, folder names, and environment variables to match this repository.

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- PostgreSQL 16
- A Google Cloud Vision API key
- (Optional) A Qdrant instance / API key for the AI assistant

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# configure environment (see .env.example)
alembic upgrade head            # run database migrations
uvicorn app.main:app --reload   # start the API
```

### Mobile app

```bash
cd mobile
npm install
npx expo start                  # open in Expo Go, or run on a simulator
```

### Environment variables

Create a `.env` file for the backend with values such as:

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/receiptiq
JWT_SECRET=your-secret
GOOGLE_APPLICATION_CREDENTIALS=path/to/vision-credentials.json
QDRANT_URL=your-qdrant-url
QDRANT_API_KEY=your-qdrant-key
```

<!-- Replace the variable names above with the exact keys your code expects. -->

## OCR Performance

On real receipt images, Google Cloud Vision API achieved a **79–83% confidence score**, extracting **27–58 lines** of text per receipt — clearly outperforming Tesseract, which is why Vision is used as the primary provider and Tesseract as a fallback.

## Roadmap

- [ ] Add screenshots and a demo video
- [ ] Publish a hosted demo / TestFlight–Play Store build
- [ ] Expand test coverage for the OCR and categorization pipeline

## Author

**Burak Sayan** — Computer Engineering graduate, mobile developer (React Native)

- GitHub: [@Buraksyn0](https://github.com/Buraksyn0)
- LinkedIn: [buraksayan](https://www.linkedin.com/in/buraksayan)

<!-- Consider adding a LICENSE file (e.g. MIT) and referencing it here. -->

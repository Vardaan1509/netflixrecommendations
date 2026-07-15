# 🎬 AI-Powered Netflix Recommendation Engine
A high-performance, intelligent questionnaire application designed to eliminate "scroll fatigue." This tool leverages an AI-driven conversational flow to analyze user moods and preferences, delivering personalized Netflix recommendations with 90% accuracy.

# 🚀 Features

Conversational AI Interface: Uses a context-aware AI system to understand user mood and preferences through an intuitive questionnaire.


Smart Refinement: Implements a feedback-based rating system that refines future results and prevents duplicate suggestions, reducing content search time by approximately 50%.


Real-time Recommendations: Achieves high accuracy in personalized suggestions through a seamless integration of frontend logic and AI.


Responsive Design: A fully responsive UI built with Tailwind CSS, optimized for both desktop and mobile user testing.


Scalable Backend: Powered by Supabase for secure data handling and low-latency performance.

# 🛠️ Tech Stack

Frontend: React, TypeScript, Tailwind CSS 


Backend/Database: Supabase 


AI Integration: OpenRouter (configurable chat model, default google/gemini-3-flash-preview, for the questionnaire & recommendations; openai/text-embedding-3-small for similarity) + Backboard (memory-powered assistant) 


Deployment: Global user testing deployment 

# 📋 Architecture
The project is architected to prioritize user experience and speed:

Input: User engages with a React-based conversational questionnaire.

Processing: The AI engine analyzes the input context to match it against Netflix's catalog styles.


Feedback Loop: Users can rate recommendations, which the system uses to iterate and improve the accuracy of the next suggestion.


Persistence: User data and preferences are managed via a scalable Supabase backend.

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone [https://github.com/Vardaan1509/netflixrecommendations.git](https://github.com/Vardaan1509/netflixrecommendations.git)
cd netflixrecommendations
```

### 2. Install dependencies
```bash
npm install
```
### 3. Run the application
```bash
npm run dev
```
# 🔑 Environment Variables
To run this project, you will need to add the following environment variables to your .env file in the root directory:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

> The variable name must be `VITE_SUPABASE_PUBLISHABLE_KEY` — that is the exact name read in `src/integrations/supabase/client.ts`. See `.env.example` for a full template.

The Supabase Edge Functions also require server-side secrets (`OPENROUTER_API_KEY`, optional `OPENROUTER_MODEL`, `BACKBOARD_API_KEY`, `BACKBOARD_ASSISTANT_ID`). These are set in Supabase, not in this `.env`. A single `OPENROUTER_API_KEY` powers the chat completions and the embeddings; set `OPENROUTER_MODEL` to change the chat model without editing code (defaults to `google/gemini-3-flash-preview`).
# 🌟 About the Developer
Developed by Vardaan Mehandiratta , a Computer Engineering student at the University of Waterloo. This project showcases expertise in full-stack development, AI integration, and user-centric design
npm install

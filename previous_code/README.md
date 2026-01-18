# ACE Reputations Leak Detection Web App

A professional-grade web application that wraps around a content-leak detection toolchain. This tool uses Google Programmable Search API and OpenAI to identify NSFW-related content associated with specific creators and then learns and predicts future keywords.

## Project Overview

This application consists of:

1. **Frontend**: React application with Tailwind CSS for styling
   - Dashboard UI with tabs for creator search, suggested keywords, results, stats, export, and settings
   - Modern, responsive design with loading indicators and error handling

2. **Backend**: Node.js/Express API server
   - REST APIs to interact with the leak detection logic
   - Secure handling of API keys and configuration

## Features

- Creator search interface
- AI-powered keyword suggestions
- Google Custom Search Engine integration
- Results viewer with pagination
- Content statistics and visualization
- Export options (CSV, Excel, JSON)
- Settings management for API keys and defaults

## Directory Structure

```
/
├── frontend/                  # React frontend
│   ├── public/
│   └── src/
│       ├── components/        # UI components
│       ├── pages/             # Page components
│       ├── services/          # API services
│       └── utils/             # Utility functions
├── backend/                   # Node.js backend
│   ├── src/
│       ├── controllers/       # API controllers
│       ├── routes/            # API routes
│       ├── services/          # Core services
│       └── utils/             # Utility functions
└── data/                      # Data directories
    ├── temp_results/          # Temporary scan results
    ├── master_data/           # Master content repository
    └── knowledge_base/        # Keyword learning database
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google Custom Search API key
- OpenAI API key

### Installation

1. Clone the repository
2. Install backend dependencies:
   ```
   cd backend
   npm install
   ```
3. Install frontend dependencies:
   ```
   cd frontend
   npm install
   ```
4. Create a `.env` file in the backend directory with the following variables:
   ```
   PORT=5000
   GOOGLE_API_KEY=your_google_api_key_here
   SEARCH_ENGINE_ID=your_search_engine_id_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

### Running the Application

1. Start the backend server:
   ```
   cd backend
   npm run dev
   ```
2. Start the frontend development server:
   ```
   cd frontend
   npm start
   ```
3. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Creator Search**: Enter a creator name to begin the process
2. **Suggested Keywords**: View AI-suggested keywords or enter your own
3. **Results**: View detected content with pagination
4. **Content Stats**: Analyze statistics about collected content
5. **Export**: Export data in various formats
6. **Settings**: Configure API keys and default settings

## Technical Implementation

- The application uses TypeScript for type safety
- React with Tailwind CSS for the frontend UI
- Node.js with Express for the backend API
- Axios for API communication
- OpenAI API for keyword learning
- Google Custom Search API for content detection

## Security

- API keys are stored securely on the server side
- No sensitive information is exposed to the client
- All API requests are validated on the server

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

## Contact

For any questions or support, please contact Ace Reputations.

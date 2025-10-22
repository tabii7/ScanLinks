# AceTrack™ - ORM Tracking and Reporting Platform

A comprehensive web-based ORM (Online Reputation Management) tracking and analysis system designed to monitor, analyze, and report online reputation progress for multiple clients.

## 🚀 Features

### Core Functionality
- **Multi-tenant Architecture**: Isolated datasets per client
- **Automated Weekly Scanning**: Google Custom Search API integration
- **AI-Powered Sentiment Analysis**: OpenAI GPT integration
- **Rank Comparison Engine**: Tracks link movements (Up, Down, New, Disappeared)
- **Professional Report Generation**: PDF and Excel exports with AI summaries
- **Real-time Dashboards**: Beautiful, responsive UI with modern design

### User Roles
- **Admin**: Manage clients, keywords, trigger scans, view all reports
- **Client**: View personalized dashboard, download reports, track progress

### Key Capabilities
- Track keywords across multiple regions (US, UK, UAE, etc.)
- Sentiment classification (Positive, Negative, Neutral, Unrelated)
- Movement detection and tracking
- Automated weekly scanning with CRON jobs
- Professional report generation with charts and AI summaries
- Modern, corporate UI with Ace Reputations branding

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** authentication
- **Google Custom Search API** for web scraping
- **OpenAI API** for sentiment analysis and summaries
- **PDFKit** and **ExcelJS** for report generation
- **Node-cron** for automated scanning

### Frontend
- **React.js** with modern hooks
- **TailwindCSS** for styling
- **Framer Motion** for animations
- **React Router** for navigation
- **Axios** for API calls
- **Recharts** for data visualization

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud)
- Google Custom Search API key
- OpenAI API key

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd acetrack-orm
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Environment Setup**
   ```bash
   # Copy environment files
   cp server/.env.example server/.env
   
   # Edit server/.env with your API keys
   MONGODB_URI=mongodb://localhost:27017/acetrack
   JWT_SECRET=your-super-secret-jwt-key
   GOOGLE_API_KEY=your-google-api-key
   GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id
   OPENAI_API_KEY=your-openai-api-key
   ```

4. **Start the application**
   ```bash
   # Development mode (both frontend and backend)
   npm run dev
   
   # Or start individually
   npm run server  # Backend only
   npm run client  # Frontend only
   ```

## 🔧 API Configuration

### Google Custom Search API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Custom Search API
3. Create a Custom Search Engine at [cse.google.com](https://cse.google.com/)
4. Get your API key and Search Engine ID

### OpenAI API
1. Sign up at [OpenAI](https://openai.com/)
2. Get your API key from the dashboard
3. Add it to your environment variables

## 📊 Database Schema

### Core Models
- **Users**: Authentication and role management
- **Clients**: Client information and subscription details
- **Keywords**: Tracked keywords per client
- **Scans**: Scan execution records
- **ScanResults**: Individual search results with sentiment
- **Reports**: Generated reports with statistics

## 🎯 Usage

### Admin Workflow
1. **Create Clients**: Add client information and subscription details
2. **Manage Keywords**: Add keywords for tracking across regions
3. **Trigger Scans**: Run manual scans or let automation handle it
4. **Monitor Results**: View scan results and sentiment analysis
5. **Generate Reports**: Create and download professional reports

### Client Workflow
1. **Login**: Access personalized dashboard
2. **View Progress**: Track campaign progress and statistics
3. **Download Reports**: Get PDF and Excel reports
4. **Monitor Regions**: Switch between different regions

## 🔄 Automation

The system includes automated features:
- **Weekly CRON Jobs**: Automatic scanning every Monday at 9 AM
- **Sentiment Analysis**: AI-powered classification of search results
- **Report Generation**: Automatic report creation after scans
- **Movement Detection**: Automatic comparison with previous scans

## 📈 Key Metrics

- **Links Removed**: Negative content successfully removed
- **De-Indexed**: Content removed from search results
- **Suppressed**: Negative content pushed down in rankings
- **New Positive Links**: Positive content appearing in search results
- **Sentiment Score**: Overall reputation health metric

## 🎨 UI Features

- **Modern Design**: Clean, corporate interface
- **Responsive Layout**: Works on all devices
- **Smooth Animations**: Framer Motion integration
- **Real-time Updates**: Live data refresh
- **Professional Branding**: Ace Reputations theme

## 🔒 Security

- **JWT Authentication**: Secure token-based auth
- **Role-based Access**: Admin and client separation
- **Data Isolation**: Client data separation
- **API Rate Limiting**: Prevents abuse
- **Input Validation**: Secure data handling

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/change-password` - Change password

### Clients
- `GET /api/clients` - List all clients (admin)
- `POST /api/clients` - Create client (admin)
- `PUT /api/clients/:id` - Update client (admin)
- `DELETE /api/clients/:id` - Delete client (admin)

### Keywords
- `GET /api/keywords` - List keywords
- `POST /api/keywords` - Create keyword
- `PUT /api/keywords/:id` - Update keyword
- `DELETE /api/keywords/:id` - Delete keyword

### Scans
- `POST /api/scans/trigger` - Trigger manual scan
- `GET /api/scans` - List scans
- `GET /api/scans/:id/results` - Get scan results

### Reports
- `GET /api/reports` - List reports
- `GET /api/reports/:id/download/pdf` - Download PDF
- `GET /api/reports/:id/download/excel` - Download Excel

## 🚀 Deployment

### Production Setup
1. **Environment Variables**: Set production values
2. **Database**: Use MongoDB Atlas or production MongoDB
3. **File Storage**: Configure upload paths
4. **SSL**: Enable HTTPS
5. **Monitoring**: Set up logging and monitoring

### Docker Deployment
```bash
# Build and run with Docker
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is proprietary software owned by Ace Reputations.

## 🆘 Support

For support and questions:
- Email: support@acereputations.com
- Documentation: [Internal Wiki]
- Issues: [GitHub Issues]

## 🔮 Future Enhancements

- **Real-time Scanning**: Daily instead of weekly
- **ORM Risk Score**: AI-generated risk assessment
- **Automated Recommendations**: AI-powered suggestions
- **Email Alerts**: Notification system
- **Multi-search Engine**: Bing, Yahoo, DuckDuckGo integration
- **Executive Summaries**: AI-written overviews

---

**AceTrack™** - Professional ORM Management Platform
© 2024 Ace Reputations. All rights reserved.




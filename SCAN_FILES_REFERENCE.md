# SCAN & CHILD SCAN & COMPARISON - Files Reference

## 📁 SCAN FUNCTIONALITY FILES

### Backend (Server)

#### **1. Scan Routes** - API Endpoints
- **`server/routes/scans.js`**
  - `POST /` - Create new scan
  - `GET /` - Get all scans
  - `GET /client` - Get client scans
  - `GET /:scanId` - Get scan by ID
  - `POST /:scanId/results` - Save scan results
  - `DELETE /:scanId` - Delete scan

#### **2. ORM Scan Routes** - Main Scan Trigger
- **`server/routes/orm-scan.js`**
  - `POST /trigger` - Trigger manual scan (calls `ormScanService.triggerManualScan`)
  - `GET /history/:clientId` - Get scan history
  - `GET /results/:scanId` - Get scan results

#### **3. ORM Scan Service** - Core Scan Logic
- **`server/services/ormScanService.js`**
  - `triggerManualScan()` - Entry point for manual scans
  - `performFullScan()` - Main scan execution:
    - Step 1: Google Search API call
    - Step 2: OpenAI sentiment analysis
    - Step 3: Get previous scan for comparison
    - Step 4: Compare ranks
    - Step 5: Save results
  - `saveScanResults()` - Save scan and results to database
  - `saveIndividualResults()` - Save individual ScanResult documents
  - `getPreviousScan()` - Get previous scan for comparison
  - `analyzeSentimentWithTimeout()` - Sentiment analysis with timeout

#### **4. Google Search Service**
- **`server/services/googleSearchService.js`**
  - `searchKeywords()` - Search Google with keywords
  - `performMultipleSearches()` - Paginated search (multiple pages)
  - `performSearch()` - Single Google API call
  - Builds enhanced query (clientName + keyword + contentType filters)
  - Handles dateRestrict, gl (geolocation), fileType parameters

#### **5. Sentiment Analysis Service**
- **`server/services/sentimentAnalysisService.js`**
  - `analyzeSentiment()` - Analyze sentiment using OpenAI
  - `createAnalysisPrompt()` - Create prompt for OpenAI
  - `parseOpenAIResponse()` - Parse OpenAI JSON response

#### **6. Scan Service** - General Scan Operations
- **`server/services/scanService.js`**
  - `runScan()` - Run scan (legacy)
  - `getScanResults()` - Get results from database
  - `getScanHistory()` - Get scan history
  - `compareWithPreviousScan()` - Compare with previous scan

#### **7. Models**
- **`server/models/Scan.js`**
  - Scan schema (clientId, weekNumber, region, status, searchQuery, timeFrame, contentType, parentId, etc.)
- **`server/models/ScanResult.js`**
  - ScanResult schema (scanId, url, title, position, sentiment, sentimentScore, etc.)

#### **8. Frontend - Scan Configuration**
- **`client/src/pages/admin/ScanConfiguration.js`**
  - Form for configuring scans
  - Collects: client, keywords, region, timeFrame, contentType, resultsCount
  - Calls `POST /orm-scan/trigger`

#### **9. Frontend - Scan Results Display**
- **`client/src/pages/admin/ScanResultsPage.js`**
  - Displays results for a single scan
  - Shows: title, snippet, position, sentiment, confidence
  - List view (not table)

---

## 📁 CHILD SCAN FUNCTIONALITY FILES

### Backend (Server)

#### **1. Child Scan Creation Routes**
- **`server/routes/scans.js`** (Lines 638-795, 798-944)
  - `POST /:parentId/create-child` - Create child scan manually
  - `POST /create-child/:parentId` - Mirror route
  - Logic:
    1. Fetch parent scan
    2. Create child scan record (inherits all parameters)
    3. Call `ormScanService.triggerManualScan()` with parent's exact parameters
    4. Update child scan status

#### **2. Scheduled Child Scan (Auto/Weekly)**
- **`server/services/scheduler/agenda.js`**
  - `agenda.define('weekly-scan', ...)` - Job definition for weekly scans
  - Creates child scan automatically every 7 days
  - Uses `ormScanService.triggerManualScan()` with parent's exact parameters
- **`server/services/scheduler/schedulerService.js`**
  - Wrapper around agenda.js
- **`server/routes/schedule.js`**
  - `POST /:parentId/start` - Start weekly schedule
  - `POST /:parentId/stop` - Stop weekly schedule
  - `GET /:parentId/status` - Get schedule status

#### **3. Child Scan Logic**
- **`server/services/ormScanService.js`**
  - `performFullScan()` - Handles child scans when `options.parentId` is present
  - Fetches parent scan for comparison
  - Uses exact same parameters as parent (timeFrame, contentType, resultsCount, searchQuery)

#### **4. Frontend - Child Scan Management**
- **`client/src/pages/admin/ModernReportManagement.js`**
  - "Add Child Scan" button
  - Calls `POST /scans/:parentId/create-child`
  - Shows schedule status

---

## 📁 COMPARISON FUNCTIONALITY FILES

### Backend (Server)

#### **1. Rank Comparison Service**
- **`server/services/rankComparisonService.js`**
  - `compareRanks()` - Compare current scan vs previous scan
  - Determines: improved, dropped, new, disappeared, unchanged
  - Compares by keyword and link URLs
  - Returns movement types and position changes

#### **2. Comparison in ORM Scan Service**
- **`server/services/ormScanService.js`**
  - `performFullScan()` - Step 4: Compare ranks
  - Calls `rankComparisonService.compareRanks()`
  - For child scans: compares with parent scan
  - For parent scans: compares with most recent completed scan

#### **3. Report Service - Aggregate Comparison**
- **`server/services/reportService.js`**
  - `generateAggregateReportFromParent()` - Generate comparison report
  - Gathers all results from parent + children
  - Builds baseline-first comparison
  - Calculates weekly movements
  - Creates ranking changes and sentiment changes

#### **4. Frontend - Comparison Display**

##### **Admin View:**
- **`client/src/pages/admin/ComprehensiveScanResults.js`**
  - `buildComparisonData()` - Builds comparison table data
  - Compares parent scan (Week 1) vs latest child scan (Week 2)
  - Shows: rankBefore, rankAfter, movement, movementText
  - **NOTE: Currently shows simple list view (removed comparison table)**

##### **Client View:**
- **`client/src/pages/client/ClientScanResults.js`**
  - Shows comprehensive view (parent + children)
  - Displays all results in list format

---

## 🔄 COMPLETE FLOW

### **Manual Scan Flow:**
```
1. Frontend: ScanConfiguration.js
   ↓
2. POST /orm-scan/trigger
   ↓
3. ormScanService.triggerManualScan()
   ↓
4. ormScanService.performFullScan()
   ├─→ googleSearchService.searchKeywords() → Google API
   ├─→ sentimentAnalysisService.analyzeSentiment() → OpenAI
   ├─→ rankComparisonService.compareRanks() → Compare with previous
   └─→ ormScanService.saveScanResults() → Save to database
       └─→ ormScanService.saveIndividualResults() → Save ScanResult docs
```

### **Child Scan Flow:**
```
1. Frontend: ModernReportManagement.js (Add Child Scan button)
   OR
   Scheduler: agenda.js (weekly-scan job)
   ↓
2. POST /scans/:parentId/create-child
   OR
   agenda.js creates child scan
   ↓
3. Create child Scan record (inherits parent params)
   ↓
4. ormScanService.triggerManualScan()
   (with parentId in options)
   ↓
5. ormScanService.performFullScan()
   ├─→ Uses parent's exact parameters (timeFrame, contentType, searchQuery)
   ├─→ googleSearchService.searchKeywords() → Google API
   ├─→ sentimentAnalysisService.analyzeSentiment() → OpenAI
   ├─→ Get parent scan for comparison (options.parentId)
   ├─→ rankComparisonService.compareRanks() → Compare with parent
   └─→ ormScanService.saveScanResults() → Save to database
```

### **Comparison Flow:**
```
1. Backend: rankComparisonService.compareRanks()
   ├─→ Compares currentScan.keywords vs previousScan.keywords
   ├─→ For each keyword: compares links
   └─→ Returns: improved, dropped, new, disappeared, unchanged

2. Frontend: ComprehensiveScanResults.js
   ├─→ buildComparisonData()
   ├─→ Gets parent scan results (Week 1)
   ├─→ Gets latest child scan results (Week 2)
   ├─→ Maps URLs to compare positions
   └─→ Calculates movement (improved/dropped/new/disappeared)
```

---

## 📊 DATA MODELS

### **Scan Model** (`server/models/Scan.js`)
```javascript
{
  clientId: ObjectId,
  clientName: String,
  weekNumber: Number,
  region: String,
  status: 'pending'|'running'|'completed'|'failed',
  clientStatus: 'not_sent'|'sent'|'viewed',
  scanType: 'manual'|'auto',
  parentId: ObjectId (null for parent, ObjectId for child),
  searchQuery: String,
  timeFrame: 'past_week'|'past_month'|...,
  contentType: 'all'|'news'|'blogs'|...,
  resultsCount: Number,
  startedAt: Date,
  completedAt: Date
}
```

### **ScanResult Model** (`server/models/ScanResult.js`)
```javascript
{
  scanId: ObjectId,
  clientId: ObjectId,
  keywordId: ObjectId,
  keyword: String,
  url: String,
  title: String,
  description: String,
  position: Number,
  rank: Number,
  sentiment: 'positive'|'negative'|'neutral'|'unrelated',
  sentimentScore: Number,
  site: String,
  region: String,
  dateFetched: Date,
  metadata: {
    sentimentAnalyzed: Boolean
  }
}
```

---

## 🎯 KEY FUNCTIONS

### **Scan Execution:**
- `ormScanService.triggerManualScan()` - Entry point
- `ormScanService.performFullScan()` - Main execution
- `googleSearchService.searchKeywords()` - Google search
- `sentimentAnalysisService.analyzeSentiment()` - Sentiment analysis
- `ormScanService.saveScanResults()` - Save to database

### **Child Scan:**
- `server/routes/scans.js` - `POST /:parentId/create-child` - Create child
- `server/services/scheduler/agenda.js` - `weekly-scan` job - Auto schedule
- `ormScanService.performFullScan()` - Executes with `options.parentId`

### **Comparison:**
- `rankComparisonService.compareRanks()` - Compare two scans
- `ormScanService.getPreviousScan()` - Get previous scan
- `ComprehensiveScanResults.js` - `buildComparisonData()` - Frontend comparison

---

## 📝 SUMMARY

**Scan Files:**
- Routes: `scans.js`, `orm-scan.js`
- Services: `ormScanService.js`, `googleSearchService.js`, `sentimentAnalysisService.js`, `scanService.js`
- Models: `Scan.js`, `ScanResult.js`
- Frontend: `ScanConfiguration.js`, `ScanResultsPage.js`

**Child Scan Files:**
- Routes: `scans.js` (create-child endpoints)
- Services: `scheduler/agenda.js`, `ormScanService.js`
- Frontend: `ModernReportManagement.js`

**Comparison Files:**
- Services: `rankComparisonService.js`, `ormScanService.js`, `reportService.js`
- Frontend: `ComprehensiveScanResults.js`, `ClientScanResults.js`


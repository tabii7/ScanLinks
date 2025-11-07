# Complete Scan Flow Documentation

## Overview
This document explains the complete flow of how a scan works from start to finish.

---

## 1. Frontend: Admin Triggers Scan

**File:** `client/src/pages/admin/ScanConfiguration.js`

### Step 1: Admin Fills Form
- Selects client
- Enters keywords (one per line)
- Selects region (US, UK, UAE, etc.)
- Sets number of results (1-10)
- Sets time frame (past_week, past_month, all)
- Sets content type (all, news, images, etc.)

### Step 2: Form Submission
```javascript
// Saves keywords to database
POST /keywords/bulk-create

// Triggers the scan
POST /orm-scan/trigger
{
  clientId: "...",
  keywords: ["keyword1", "keyword2"],
  region: "US",
  options: {
    clientName: "Client Name",
    resultsCount: 10,
    timeFrame: "past_week",
    contentType: "all"
  }
}
```

### Step 3: Redirect
- Navigates to `/admin/scans/{scanId}` to view results

---

## 2. Backend: Route Handler

**File:** `server/routes/orm-scan.js`

```javascript
POST /orm-scan/trigger
  ↓
ormScanService.triggerManualScan(clientId, keywords, region, options)
```

---

## 3. Backend: Trigger Manual Scan

**File:** `server/services/ormScanService.js`

### Function: `triggerManualScan()`
```javascript
async triggerManualScan(clientId, keywords, region, options) {
  // Calls performFullScan() which does all the work
  const scanResults = await this.performFullScan(clientId, keywords, region, options);
  
  return {
    success: true,
    scanId: scanResults.scanId,
    message: 'Scan triggered successfully'
  };
}
```

---

## 4. Backend: Perform Full Scan

**File:** `server/services/ormScanService.js`

### Function: `performFullScan()`

This is the **MAIN FUNCTION** that orchestrates the entire scan process.

#### **Step 1: Prepare Scan Record**
- Creates a new `Scan` document in MongoDB
- Sets status to 'running'
- Stores: clientId, region, keywords, timeFrame, contentType, resultsCount
- Generates unique scanId

#### **Step 2: Google Search API**
**File:** `server/services/googleSearchService.js`

```javascript
// Combines keywords with client name
searchQuery = "Client Name keyword1 keyword2"

// Calls Google Custom Search API
const searchResponse = await googleSearchService.searchKeywords(
  keywords,
  region,
  resultsCount,
  {
    timeFrame: "past_week",  // Converts to dateRestrict: "w1"
    contentType: "all",
    parentExactQuery: null,  // Only for child scans
    parentDateRestrict: null // Only for child scans
  }
);

// Returns:
{
  results: [
    {
      title: "...",
      link: "https://...",
      snippet: "...",
      position: 1,
      domain: "..."
    },
    ...
  ],
  exactGoogleQuery: "actual query sent to Google",
  exactDateRestrict: "w1" // or null if "all"
}
```

**Parameters sent to Google:**
- `q`: Search query (e.g., "josh adler scam")
- `gl`: Region (lowercase, e.g., "us")
- `cr`: Country restriction (e.g., "countryUS")
- `dateRestrict`: Time frame (e.g., "w1" for past week, or omitted for "all")
- `num`: Number of results (1-10)
- `fileType`: Content type filter
- `searchType`: Search type filter

#### **Step 3: OpenAI Sentiment Analysis**
**File:** `server/services/sentimentAnalysisService.js`

```javascript
// Calls OpenAI API with timeout protection
const sentimentResults = await this.analyzeSentimentWithTimeout(
  searchResults,
  clientData
);
```

**What happens:**
1. Checks if OpenAI API key is configured
2. Builds prompt with:
   - Client context (name, industry, business type)
   - Search results (title, URL, snippet for each)
3. Sends to OpenAI GPT-4:
   ```
   POST https://api.openai.com/v1/chat/completions
   {
     model: "gpt-4",
     messages: [
       {
         role: "system",
         content: "You are an expert ORM analyst..."
       },
       {
         role: "user",
         content: "Analyze these search results for sentiment: ..."
       }
     ]
   }
   ```
4. Parses OpenAI response (JSON format):
   ```json
   {
     "results": [
       {
         "index": 1,
         "sentiment": "positive|negative|neutral",
         "confidence": 0.0-1.0,
         "reasoning": "Brief explanation",
         "category": "reviews|news|social|other",
         "keywords": ["keyword1"],
         "relevance": "high|medium|low"
       }
     ]
   }
   ```
5. Maps results back to original links
6. Sets `_sentimentAnalyzed: true` flag if successful
7. If OpenAI fails (401, timeout, etc.):
   - Sets `_sentimentAnalyzed: false`
   - Uses default sentiment: 'neutral'
   - Uses default confidence: 0.5
   - Frontend will show "Sentiments Not Created"

**Current Issue:** OpenAI API key is invalid (401 error), so all results get `_sentimentAnalyzed: false` and default to 'neutral'.

#### **Step 4: Compare with Previous Scan**
**File:** `server/services/rankComparisonService.js`

```javascript
// If this is a child scan, compare with parent
// If this is a parent scan, compare with most recent scan
const rankComparison = await rankComparisonService.compareRanks(
  currentScan,
  previousScan
);
```

**What it does:**
- Matches links between current and previous scan (normalizes URLs)
- Calculates movement:
  - **NEW**: Link appears in current but not previous
  - **IMPROVED**: Link moved up in rankings
  - **DROPPED**: Link moved down in rankings
  - **DISAPPEARED**: Link was in previous but not current
  - **UNCHANGED**: Link stayed in same position

#### **Step 5: Generate Report Summary**
**File:** `server/services/sentimentAnalysisService.js`

```javascript
const reportSummary = await sentimentAnalysisService.generateReportSummary(
  sentimentResults,
  clientData
);
```

**Generates:**
- Total results count
- Sentiment breakdown (positive/negative/neutral counts and percentages)
- Overall sentiment
- Key findings (top negative results)
- Recommendations

#### **Step 6: Save Scan Results**
**File:** `server/services/ormScanService.js`

```javascript
// Saves to ScanResult collection
await this.saveIndividualResults(
  scanId,
  sentimentResults,
  clientId,
  region
);
```

**What gets saved:**
- Each search result as a `ScanResult` document
- Fields: scanId, clientId, keywordId, url, title, description, position, sentiment, sentimentScore, category, relevance, metadata.sentimentAnalyzed
- **CRITICAL:** Stores `exactGoogleQuery` and `exactDateRestrict` in Scan document for child scans

#### **Step 7: Update Scan Status**
```javascript
// Updates Scan document
scan.status = 'completed';
scan.completedAt = new Date();
scan.resultsCount = sentimentResults.length;
scan.autoScanEnabled = true;
scan.nextAutoScanDate = 7 days from now;
```

---

## 5. Frontend: Display Results

**File:** `client/src/pages/admin/ScanResultsPage.js`

### When viewing scan results:

1. **Fetches Scan Data:**
   ```
   GET /scans/{scanId}
   ```

2. **Fetches Results:**
   ```
   GET /scans/{scanId}/results
   ```

3. **Displays Results:**
   - Shows each result with:
     - Title, URL, snippet
     - Position/rank
     - **Sentiment** (from OpenAI if `metadata.sentimentAnalyzed === true`, else shows "Sentiments Not Created")
     - Confidence score
     - Movement (if compared with previous scan)

---

## Current Flow Summary

```
1. Admin fills form → POST /orm-scan/trigger
2. Backend: triggerManualScan() → performFullScan()
3. performFullScan():
   a. Create Scan record (status: 'running')
   b. Google Search API → Get search results
   c. OpenAI API → Analyze sentiment (CURRENTLY FAILING - 401 error)
   d. Rank Comparison → Compare with previous scan
   e. Generate Report Summary
   f. Save results to database
   g. Update Scan (status: 'completed')
4. Frontend: Fetch and display results
```

---

## Current Issues

1. **OpenAI API Key Invalid (401 Error)**
   - Key is 164 characters (should be ~51)
   - All sentiments default to 'neutral' with `_sentimentAnalyzed: false`
   - Frontend shows "Sentiments Not Created"

2. **Fix Required:**
   - Update `server/.env` with valid OpenAI API key
   - Key should be ~51 characters, start with `sk-` or `sk-proj-`
   - Restart server after updating

---

## Child Scan Flow

Child scans follow the **EXACT SAME** flow as parent scans:

1. Uses parent's `exactGoogleQuery` (no query modification)
2. Uses parent's `exactDateRestrict` (exact same date restriction)
3. Uses parent's `timeFrame`, `contentType`, `resultsCount`
4. Calls same `performFullScan()` function
5. Gets same OpenAI sentiment analysis
6. Saves with `parentId` reference

---

## Scheduled Scan Flow

**File:** `server/services/scheduler/agenda.js`

1. Runs automatically 7 days after parent scan completes
2. Creates child scan record
3. Calls `ormScanService.triggerManualScan()` with parent parameters
4. Follows exact same flow as manual child scan


# CHILD SCAN FLOW - Complete Explanation

## How Child Scan Works:

### Step 1: Child Scan Triggered
```
Location: server/routes/scans.js (line 638-795)
```

1. Admin clicks "Add Child Scan" OR scheduled scan runs automatically
2. System fetches parent scan from database
3. Creates new child scan record with:
   - `parentId`: parent scan ID
   - `searchQuery`: parent.searchQuery (exact copy)
   - `timeFrame`: parent.timeFrame (exact copy)
   - `contentType`: parent.contentType (exact copy)
   - `resultsCount`: parent.resultsCount (exact copy)
   - `region`: parent.region (exact copy)
   - `weekNumber`: parent.weekNumber + 1

### Step 2: Call Google Search API
```
Location: server/services/ormScanService.js → performFullScan()
         → googleSearchService.searchKeywords()
```

**Flow:**
1. `triggerManualScan()` is called with parent's parameters
2. `performFullScan()` is called with:
   - `keywords`: [parent.searchQuery] (as single keyword)
   - `region`: parent.region
   - `options.resultsCount`: parent.resultsCount
   - `options.timeFrame`: parent.timeFrame
   - `options.contentType`: parent.contentType

### Step 3: Build Search Query
```
Location: server/services/googleSearchService.js (line 25-146)
```

**What happens:**
1. **Line 48-53**: Builds `enhancedQuery`:
   ```javascript
   if (clientName && !keyword.toLowerCase().includes(clientName.toLowerCase())) {
     enhancedQuery = `${clientName} ${keyword}`;
   } else {
     enhancedQuery = keyword;
   }
   ```
   - Adds client name to query if not already included

2. **Line 55-69**: Adds contentType filters:
   ```javascript
   if (searchOptions.contentType === 'news') {
     enhancedQuery = `${enhancedQuery} site:news.google.com OR site:cnn.com...`;
   }
   // etc.
   ```

3. **Line 82**: Calls `performMultipleSearches(enhancedQuery, region, numResults, searchOptions)`

### Step 4: Google API Call
```
Location: server/services/googleSearchService.js (line 186-292)
```

**Parameters sent to Google:**
```javascript
{
  q: enhancedQuery,                    // "ClientName keyword site:filters..."
  gl: 'us',                            // Region code (from parent.region)
  dateRestrict: 'd7',                  // ⚠️ RELATIVE TO NOW (not parent date!)
  num: 10,                             // Results per page
  start: 1                              // Starting index
}
```

## ⚠️ THE PROBLEM: Why Results Are Different

### Issue #1: dateRestrict is RELATIVE
- **Parent scan** (Day 1): `dateRestrict: 'd7'` → Gets results from Day -7 to Day 1
- **Child scan** (Day 8): `dateRestrict: 'd7'` → Gets results from Day 1 to Day 8
- **Result**: Different time windows = Different results!

### Issue #2: Google's Index Updates
- Google Custom Search API index updates periodically
- Even with same query, results can differ due to:
  - New pages indexed
  - Old pages removed
  - Ranking algorithm changes

### Issue #3: Fallback Logic
```
Location: server/services/googleSearchService.js (line 84-95)
```

If no results found:
1. Tries general search (first word only)
2. If still no results, tries basic "news" search
3. **This can yield completely different results!**

### Issue #4: Client Name Addition
- Parent scan might have had clientName added differently
- Child scan adds clientName again (might be redundant or different)

## Current Flow Diagram:

```
Child Scan Triggered
    ↓
Get parent.searchQuery, parent.timeFrame, parent.contentType
    ↓
Build enhancedQuery = clientName + searchQuery + contentType filters
    ↓
Call Google API with:
  - q: enhancedQuery
  - gl: region
  - dateRestrict: 'd7' (relative to NOW, not parent date!)
    ↓
Google returns results (different time window = different results)
    ↓
If no results → Try fallback searches (different results!)
    ↓
Process results → Save to database
```

## Solutions:

### Option 1: Remove dateRestrict for Child Scans
- Child scans should compare current results vs parent results
- Don't restrict by date, get latest results

### Option 2: Use Fixed Date Range
- Store parent scan's actual date range
- Child scan uses same fixed range (won't work for weekly comparisons)

### Option 3: Disable Fallback Searches for Child Scans
- Child scans should fail if no results (don't try fallbacks)
- This ensures results are comparable

### Option 4: Store Parent's Exact Query
- Store the exact enhancedQuery used in parent scan
- Child scan uses exact same query (no clientName re-addition)


# Link Comparison Flow: Parent vs Child Scans

## Overview
All child scans compare their results with the **PARENT scan** (Week 1), not the previous child scan. This ensures consistent baseline comparison.

## Flow Diagram

```
1. CHILD SCAN TRIGGERED
   ↓
2. Fetch Google Search Results (using parent's exact parameters)
   ↓
3. Analyze Sentiment (OpenAI)
   ↓
4. COMPARISON STEP:
   ├─ Check: Does options.parentId exist?
   ├─ YES (Child Scan):
   │   ├─ Fetch Parent Scan from database
   │   ├─ Fetch Parent's ScanResults from database
   │   ├─ Group parent results by keyword
   │   └─ Compare current results with parent results
   │
   └─ NO (Parent Scan):
       ├─ Fetch most recent completed scan
       └─ Compare with it (if exists)
   ↓
5. Determine Movement Types:
   ├─ improved: Link moved UP in rank (position decreased)
   ├─ dropped: Link moved DOWN in rank (position increased)
   ├─ new: Link not in parent scan
   ├─ disappeared: Link was in parent but not in child
   └─ stable: Link in same position
   ↓
6. Save Results with Movement Data
```

## Detailed Comparison Process

### Step 1: Identify Comparison Target
```javascript
if (options.parentId) {
  // CHILD SCAN: Always compare with PARENT
  previousScan = await Scan.findById(parentId);
} else {
  // PARENT SCAN: Compare with most recent scan
  previousScan = await this.getPreviousScan(clientId, region);
}
```

### Step 2: Fetch Previous Results
```javascript
const previousResults = await ScanResult.find({ 
  scanId: previousScan._id 
}).sort({ position: 1 });
```

### Step 3: Compare Links
For each link in current scan:
1. **Normalize URL** (remove www, http/https, trailing slashes)
2. **Find matching link** in parent scan
3. **Compare position/rank**:
   - If found: Compare `currentRank` vs `previousRank`
   - If not found: Mark as `new`
4. **Check disappeared**: Links in parent but not in current

### Step 4: Calculate Movement
```javascript
if (currentRank < previousRank) {
  movement = 'improved';  // Position 5 → Position 2 = improved
} else if (currentRank > previousRank) {
  movement = 'dropped';   // Position 2 → Position 5 = dropped
} else {
  movement = 'stable';   // Position 2 → Position 2 = stable
}
```

## Key Points

1. **Child scans ALWAYS compare with parent** (Week 1), not previous child
2. **URL matching** uses normalized URLs (case-insensitive, www removed)
3. **Position comparison** uses rank/position field
4. **Movement types**: improved, dropped, new, disappeared, stable
5. **All movements stored** in ScanResult documents

## Example

**Parent Scan (Week 1):**
- Link A: Position 1
- Link B: Position 2
- Link C: Position 3

**Child Scan (Week 2):**
- Link B: Position 1 (improved from 2)
- Link A: Position 2 (dropped from 1)
- Link D: Position 3 (new)
- Link C: (disappeared)

## Files Involved

- `server/services/ormScanService.js` - Main scan orchestration
- `server/services/rankComparisonService.js` - Comparison logic
- `server/services/scanService.js` - Alternative comparison method
- `server/models/ScanResult.js` - Stores movement data


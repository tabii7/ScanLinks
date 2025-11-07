const Agenda = require('agenda');
const mongoose = require('mongoose');
const Scan = require('../../models/Scan');
const ormScanService = require('../ormScanService');

let agendaInstance = null;

function getMongoConnectionString() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/acetrack';
  return uri;
}

async function initAgenda() {
  if (agendaInstance) return agendaInstance;

  const agenda = new Agenda({
    db: { address: getMongoConnectionString(), collection: 'agendaJobs' },
    processEvery: '1 minute',
    defaultConcurrency: 5,
  });

  // Define the weekly scan job
  agenda.define('weekly-scan', async (job) => {
    const { parentScanId } = job.attrs.data || {};
    if (!parentScanId) return;

    // Load parent scan
    const parent = await Scan.findById(parentScanId);
    if (!parent) return;

    // Avoid duplicate child for same week: ensure last child older than 6 days
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const recentChild = await Scan.findOne({ parentId: parent._id, startedAt: { $gte: sixDaysAgo } });
    if (recentChild) return; // already created recently

    // Create child scan with same parameters
    // If parent is already sent to client, child should also be marked as sent
    const childClientStatus = (parent.clientStatus === 'sent' || parent.clientStatus === 'viewed') 
      ? 'sent' 
      : 'not_sent';

    // CRITICAL: Calculate next week number properly (find highest week among parent + all children)
    const scanService = require('../services/scanService');
    const nextWeekNumber = await scanService.getNextWeekNumber(parent._id);
    
    console.log(`📊 Calculating week number for scheduled child scan:`);
    console.log(`   - Parent weekNumber: ${parent.weekNumber || 1}`);
    console.log(`   - Next weekNumber (calculated): ${nextWeekNumber}`);

    const child = new Scan({
      clientId: parent.clientId,
      clientName: parent.clientName,
      weekNumber: nextWeekNumber, // Use calculated next week number (not just parent + 1)
      region: parent.region,
      scanType: 'auto',
      status: 'running',
      resultsCount: 0,
      startedAt: new Date(),
      totalKeywords: parent.totalKeywords || 1,
      processedKeywords: 0,
      parentId: parent._id,
      searchQuery: parent.searchQuery || '',
      timeFrame: parent.timeFrame || 'past_week', // EXACT same as parent
      contentType: parent.contentType || 'all',   // EXACT same as parent
      clientStatus: childClientStatus,
      sentToClientAt: childClientStatus === 'sent' ? new Date() : undefined
    });
    await child.save();

    if (childClientStatus === 'sent') {
      console.log(`✅ Auto-scheduled child scan ${child._id} automatically marked as sent (parent already sent)`);
    }

    // CRITICAL: Use searchQuery as ONE keyword (don't split it) - exactly like parent scans
    let keywords = [];
    if (parent.searchQuery) {
      // Keep searchQuery as a single keyword (treat entire phrase as one)
      keywords = [parent.searchQuery];
    } else {
      // Fallback: try to fetch keywords from Keyword model
      try {
        const Keyword = require('../../models/Keyword');
        const keywordDocs = await Keyword.find({ 
          clientId: parent.clientId, 
          status: 'active',
          targetRegions: parent.region 
        });
        keywords = keywordDocs.map(k => k.keyword);
        if (keywords.length === 0) {
          console.log('⚠️ No keywords found for auto scan');
        }
      } catch (err) {
        console.error('Error fetching keywords for auto scan:', err);
      }
    }

    if (keywords.length === 0) {
      console.error('❌ No keywords found for scheduled child scan');
      await Scan.findByIdAndUpdate(child._id, {
        $set: {
          status: 'failed',
          completedAt: new Date(),
          errors: [{ error: 'No keywords found for scheduled child scan', timestamp: new Date() }]
        },
      });
      return;
    }

    // CRITICAL: Use EXACT same parameters as parent scan
    const exactResultsCount = parent.resultsCount !== undefined && parent.resultsCount !== null && parent.resultsCount > 0 
      ? parent.resultsCount 
      : 10; // Only use 10 as fallback if parent had 0 results
    const exactTimeFrame = parent.timeFrame || 'past_week';
    const exactContentType = parent.contentType || 'all';
    const exactRegion = parent.region || 'US';
    const exactSearchQuery = parent.searchQuery || keywords.join(' ');

    // CRITICAL: For child scans, use parent's EXACT query and date parameters
    // Ensure ALL parameters match parent exactly (timeFrame, contentType, resultsCount, etc.)
    console.log('🔄 SCHEDULED CHILD SCAN - Using parent parameters:');
    console.log('   - Parent ID:', parent._id.toString());
    console.log('   - Parent exactGoogleQuery:', parent.exactGoogleQuery || 'NOT STORED');
    console.log('   - Parent exactDateRestrict:', parent.exactDateRestrict || 'NOT STORED');
    console.log('   - Parent searchQuery:', parent.searchQuery);
    console.log('   - Parent timeFrame:', exactTimeFrame, '(EXACT from parent)');
    console.log('   - Parent contentType:', exactContentType, '(EXACT from parent)');
    console.log('   - Parent resultsCount:', exactResultsCount, '(EXACT from parent)');
    console.log('   - Keywords array:', keywords);
    
    const options = {
      resultsCount: exactResultsCount, // EXACT same resultsCount as parent
      clientName: parent.clientName,
      clientData: parent.clientId,
      timeFrame: exactTimeFrame, // EXACT same timeFrame as parent (no fallback)
      contentType: exactContentType, // EXACT same contentType as parent (no fallback)
      scanType: 'auto',
      scanId: child._id.toString(),
      searchQuery: exactSearchQuery, // EXACT same searchQuery as parent
      weekNumber: child.weekNumber,
      parentId: parent._id.toString(), // CRITICAL: Pass parentId for comparison
      parentExactQuery: parent.exactGoogleQuery || null, // CRITICAL: Use parent's exact query
      parentDateRestrict: parent.exactDateRestrict || null // CRITICAL: Use parent's exact dateRestrict
    };

    try {
      // Use triggerManualScan to follow exact same flow as parent scans
      const result = await ormScanService.triggerManualScan(
        parent.clientId.toString(),
        keywords, // EXACT same keywords as parent (one keyword: searchQuery)
        exactRegion, // EXACT same region
        options
      );

      // Update child scan with final status
      if (result.success) {
        const updatedScan = await Scan.findById(child._id);
        if (updatedScan) {
          await Scan.findByIdAndUpdate(child._id, {
            $set: {
              status: 'completed',
              completedAt: new Date(),
              resultsCount: updatedScan.resultsCount || 0
            },
          });
        }
      } else {
        await Scan.findByIdAndUpdate(child._id, {
          $set: {
            status: 'failed',
            completedAt: new Date(),
            errors: [{ error: result.error || result.message || 'Scan failed', timestamp: new Date() }]
          },
        });
      }
    } catch (err) {
      console.error(`❌ Scheduled child scan ${child._id} execution error:`, err);
      await Scan.findByIdAndUpdate(child._id, {
        $set: {
          status: 'failed',
          completedAt: new Date(),
          errors: [{ error: err.message, timestamp: new Date() }]
        },
      });
    }
  });

  await agenda.start();
  agendaInstance = agenda;
  return agendaInstance;
}

async function scheduleWeekly(parentScanId) {
  const agenda = await initAgenda();
  const jobId = `weekly:${parentScanId}`;
  // Remove any existing job first to avoid duplicates
  await agenda.cancel({ name: 'weekly-scan', 'data.parentScanId': parentScanId });
  await agenda.every('7 days', 'weekly-scan', { parentScanId }, { jobId });
  return { success: true, jobId };
}

async function cancelWeekly(parentScanId) {
  const agenda = await initAgenda();
  const num = await agenda.cancel({ name: 'weekly-scan', 'data.parentScanId': parentScanId });
  return { success: true, cancelled: num };
}

async function getStatus(parentScanId) {
  const agenda = await initAgenda();
  const jobs = await agenda.jobs({ name: 'weekly-scan', 'data.parentScanId': parentScanId });
  if (!jobs || jobs.length === 0) return { scheduled: false };
  const job = jobs[0];
  return {
    scheduled: true,
    nextRunAt: job.attrs.nextRunAt,
    lastRunAt: job.attrs.lastRunAt,
  };
}

module.exports = {
  initAgenda,
  scheduleWeekly,
  cancelWeekly,
  getStatus,
};

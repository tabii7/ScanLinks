class RankComparisonService {
  constructor() {
    this.comparisonTypes = {
      IMPROVED: 'improved',
      DROPPED: 'dropped', 
      NEW: 'new',
      DISAPPEARED: 'disappeared',
      STABLE: 'stable'
    };
  }

  async compareRanks(currentScan, previousScan) {
    try {
      if (!previousScan) {
        // First scan - all results are new
        return this.markAllAsNew(currentScan);
      }

      const comparisons = [];
      
      // Compare each keyword
      for (const currentKeyword of currentScan.keywords) {
        const previousKeyword = previousScan.keywords.find(
          pk => pk.keyword === currentKeyword.keyword
        );
        
        if (!previousKeyword) {
          // New keyword
          comparisons.push({
            keyword: currentKeyword.keyword,
            type: this.comparisonTypes.NEW,
            currentPosition: currentKeyword.position,
            previousPosition: null,
            change: null,
            links: currentKeyword.links
          });
          continue;
        }

        // Compare links for this keyword
        const linkComparisons = this.compareKeywordLinks(
          currentKeyword.links,
          previousKeyword.links,
          currentKeyword.keyword
        );
        
        comparisons.push({
          keyword: currentKeyword.keyword,
          type: this.comparisonTypes.STABLE,
          currentPosition: currentKeyword.position,
          previousPosition: previousKeyword.position,
          change: currentKeyword.position - previousKeyword.position,
          links: linkComparisons
        });
      }

      // Check for disappeared keywords
      for (const previousKeyword of previousScan.keywords) {
        const currentKeyword = currentScan.keywords.find(
          ck => ck.keyword === previousKeyword.keyword
        );
        
        if (!currentKeyword) {
          comparisons.push({
            keyword: previousKeyword.keyword,
            type: this.comparisonTypes.DISAPPEARED,
            currentPosition: null,
            previousPosition: previousKeyword.position,
            change: null,
            links: []
          });
        }
      }

      return {
        scanId: currentScan.id,
        previousScanId: previousScan.id,
        comparisonDate: new Date().toISOString(),
        totalKeywords: currentScan.keywords.length,
        newKeywords: comparisons.filter(c => c.type === this.comparisonTypes.NEW).length,
        disappearedKeywords: comparisons.filter(c => c.type === this.comparisonTypes.DISAPPEARED).length,
        improvedKeywords: comparisons.filter(c => c.change < 0).length,
        droppedKeywords: comparisons.filter(c => c.change > 0).length,
        stableKeywords: comparisons.filter(c => c.change === 0).length,
        comparisons: comparisons
      };
    } catch (error) {
      console.error('Rank comparison error:', error);
      throw new Error(`Rank comparison failed: ${error.message}`);
    }
  }

  compareKeywordLinks(currentLinks, previousLinks, keyword) {
    const linkComparisons = [];
    
    console.log(`🔗 Comparing links for keyword "${keyword}":`);
    console.log(`   - Current links: ${currentLinks.length}`);
    console.log(`   - Previous links: ${previousLinks.length}`);
    
    // Normalize URLs for comparison (handle www, http/https, trailing slashes)
    const normalizeUrl = (url) => {
      if (!url) return '';
      try {
        let normalized = url.toLowerCase().trim();
        // Remove protocol
        normalized = normalized.replace(/^https?:\/\//, '');
        // Remove www.
        normalized = normalized.replace(/^www\./, '');
        // Remove trailing slash
        normalized = normalized.replace(/\/$/, '');
        return normalized;
      } catch (e) {
        return url.toLowerCase().trim();
      }
    };
    
    // Find links that are new, improved, dropped, or stable
    for (const currentLink of currentLinks) {
      const currentUrl = currentLink.link || currentLink.url || '';
      const currentNormalized = normalizeUrl(currentUrl);
      
      // Try to find matching link in previous (by exact URL first, then normalized)
      const previousLink = previousLinks.find(pl => {
        const prevUrl = pl.link || pl.url || '';
        return prevUrl === currentUrl || normalizeUrl(prevUrl) === currentNormalized;
      });
      
      if (!previousLink) {
        // New link - not in parent scan
        linkComparisons.push({
          link: currentLink.link || currentLink.url,
          title: currentLink.title,
          type: this.comparisonTypes.NEW,
          currentPosition: currentLink.position || currentLink.rank,
          previousPosition: null,
          change: null,
          sentiment: currentLink.sentiment,
          domain: currentLink.domain
        });
        
        console.log(`   🆕 NEW: "${currentLink.title}" at position ${currentLink.position || currentLink.rank}`);
      } else {
        // Existing link - check position change
        const currentPos = currentLink.position || currentLink.rank;
        const previousPos = previousLink.position || previousLink.rank;
        const positionChange = currentPos - previousPos;
        let type = this.comparisonTypes.STABLE;
        
        if (positionChange < 0) {
          type = this.comparisonTypes.IMPROVED; // Position decreased = improved
        } else if (positionChange > 0) {
          type = this.comparisonTypes.DROPPED; // Position increased = dropped
        }
        
        linkComparisons.push({
          link: currentLink.link || currentLink.url,
          title: currentLink.title,
          type: type,
          currentPosition: currentPos,
          previousPosition: previousPos,
          change: positionChange,
          sentiment: currentLink.sentiment,
          domain: currentLink.domain
        });
        
        const movementEmoji = positionChange < 0 ? '⬆️' : positionChange > 0 ? '⬇️' : '➡️';
        const movementText = positionChange < 0 ? 'IMPROVED' : positionChange > 0 ? 'DROPPED' : 'STABLE';
        console.log(`   ${movementEmoji} ${movementText}: "${currentLink.title}" - Position ${previousPos} → ${currentPos} (change: ${positionChange})`);
      }
    }
    
    // Find links that disappeared (were in parent but not in current)
    for (const previousLink of previousLinks) {
      const prevUrl = previousLink.link || previousLink.url || '';
      const prevNormalized = normalizeUrl(prevUrl);
      
      const currentLink = currentLinks.find(cl => {
        const curUrl = cl.link || cl.url || '';
        return curUrl === prevUrl || normalizeUrl(curUrl) === prevNormalized;
      });
      
      if (!currentLink) {
        // Link disappeared - was in parent but not in current
        linkComparisons.push({
          link: previousLink.link || previousLink.url,
          title: previousLink.title,
          type: this.comparisonTypes.DISAPPEARED,
          currentPosition: null,
          previousPosition: previousLink.position || previousLink.rank,
          change: null,
          sentiment: previousLink.sentiment,
          domain: previousLink.domain
        });
        
        console.log(`   ❌ DISAPPEARED: "${previousLink.title}" was at position ${previousLink.position || previousLink.rank}`);
      }
    }
    
    console.log(`   ✅ Comparison complete: ${linkComparisons.length} links analyzed`);
    
    return linkComparisons;
  }

  markAllAsNew(scan) {
    const comparisons = [];
    
    for (const keyword of scan.keywords) {
      comparisons.push({
        keyword: keyword.keyword,
        type: this.comparisonTypes.NEW,
        currentPosition: keyword.position,
        previousPosition: null,
        change: null,
        links: keyword.links.map(link => ({
          link: link.link,
          title: link.title,
          type: this.comparisonTypes.NEW,
          currentPosition: link.position,
          previousPosition: null,
          change: null,
          sentiment: link.sentiment,
          domain: link.domain
        }))
      });
    }
    
    return {
      scanId: scan.id,
      previousScanId: null,
      comparisonDate: new Date().toISOString(),
      totalKeywords: scan.keywords.length,
      newKeywords: scan.keywords.length,
      disappearedKeywords: 0,
      improvedKeywords: 0,
      droppedKeywords: 0,
      stableKeywords: 0,
      comparisons: comparisons
    };
  }

  calculateRankingScore(comparison) {
    const weights = {
      [this.comparisonTypes.IMPROVED]: 2,
      [this.comparisonTypes.NEW]: 1,
      [this.comparisonTypes.STABLE]: 0,
      [this.comparisonTypes.DROPPED]: -1,
      [this.comparisonTypes.DISAPPEARED]: -2
    };
    
    let score = 0;
    let totalLinks = 0;
    
    for (const comparisonItem of comparison.comparisons) {
      for (const link of comparisonItem.links) {
        score += weights[link.type] || 0;
        totalLinks++;
      }
    }
    
    return {
      score: score,
      totalLinks: totalLinks,
      averageScore: totalLinks > 0 ? score / totalLinks : 0,
      rating: this.getRating(score, totalLinks)
    };
  }

  getRating(score, totalLinks) {
    if (totalLinks === 0) return 'N/A';
    
    const averageScore = score / totalLinks;
    
    if (averageScore >= 1) return 'Excellent';
    if (averageScore >= 0.5) return 'Good';
    if (averageScore >= 0) return 'Neutral';
    if (averageScore >= -0.5) return 'Poor';
    return 'Critical';
  }

  generateComparisonReport(comparison, clientData) {
    const score = this.calculateRankingScore(comparison);
    
    return {
      clientName: clientData.name,
      comparisonDate: comparison.comparisonDate,
      overallScore: score.score,
      totalLinks: score.totalLinks,
      averageScore: score.averageScore,
      rating: score.rating,
      summary: {
        newKeywords: comparison.newKeywords,
        disappearedKeywords: comparison.disappearedKeywords,
        improvedKeywords: comparison.improvedKeywords,
        droppedKeywords: comparison.droppedKeywords,
        stableKeywords: comparison.stableKeywords
      },
      topImprovements: this.getTopImprovements(comparison),
      topConcerns: this.getTopConcerns(comparison),
      recommendations: this.generateRecommendations(comparison, score)
    };
  }

  getTopImprovements(comparison) {
    const improvements = [];
    
    for (const comparisonItem of comparison.comparisons) {
      for (const link of comparisonItem.links) {
        if (link.type === this.comparisonTypes.IMPROVED) {
          improvements.push({
            keyword: comparisonItem.keyword,
            link: link.link,
            title: link.title,
            positionChange: link.change,
            newPosition: link.currentPosition
          });
        }
      }
    }
    
    return improvements
      .sort((a, b) => Math.abs(b.positionChange) - Math.abs(a.positionChange))
      .slice(0, 5);
  }

  getTopConcerns(comparison) {
    const concerns = [];
    
    for (const comparisonItem of comparison.comparisons) {
      for (const link of comparisonItem.links) {
        if (link.type === this.comparisonTypes.DROPPED || 
            link.type === this.comparisonTypes.DISAPPEARED) {
          concerns.push({
            keyword: comparisonItem.keyword,
            link: link.link,
            title: link.title,
            type: link.type,
            positionChange: link.change,
            previousPosition: link.previousPosition
          });
        }
      }
    }
    
    return concerns
      .sort((a, b) => Math.abs(b.positionChange) - Math.abs(a.positionChange))
      .slice(0, 5);
  }

  generateRecommendations(comparison, score) {
    const recommendations = [];
    
    if (score.rating === 'Critical' || score.rating === 'Poor') {
      recommendations.push({
        priority: 'High',
        category: 'Reputation Recovery',
        action: 'Implement immediate reputation recovery strategy',
        description: 'Focus on addressing negative content and improving positive mentions'
      });
    }
    
    if (comparison.newKeywords > 0) {
      recommendations.push({
        priority: 'Medium',
        category: 'Keyword Expansion',
        action: 'Monitor new keyword performance',
        description: 'Track the performance of newly added keywords and optimize content'
      });
    }
    
    if (comparison.disappearedKeywords > 0) {
      recommendations.push({
        priority: 'High',
        category: 'Keyword Recovery',
        action: 'Investigate disappeared keywords',
        description: 'Analyze why certain keywords are no longer appearing in search results'
      });
    }
    
    if (comparison.improvedKeywords > 0) {
      recommendations.push({
        priority: 'Low',
        category: 'Optimization',
        action: 'Continue current strategy',
        description: 'Maintain and build upon the positive momentum'
      });
    }
    
    return recommendations;
  }
}

module.exports = new RankComparisonService();




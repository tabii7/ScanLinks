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
    
    // Find links that are new, improved, dropped, or stable
    for (const currentLink of currentLinks) {
      const previousLink = previousLinks.find(
        pl => pl.link === currentLink.link
      );
      
      if (!previousLink) {
        // New link
        linkComparisons.push({
          link: currentLink.link,
          title: currentLink.title,
          type: this.comparisonTypes.NEW,
          currentPosition: currentLink.position,
          previousPosition: null,
          change: null,
          sentiment: currentLink.sentiment,
          domain: currentLink.domain
        });
      } else {
        // Existing link - check position change
        const positionChange = currentLink.position - previousLink.position;
        let type = this.comparisonTypes.STABLE;
        
        if (positionChange < 0) {
          type = this.comparisonTypes.IMPROVED;
        } else if (positionChange > 0) {
          type = this.comparisonTypes.DROPPED;
        }
        
        linkComparisons.push({
          link: currentLink.link,
          title: currentLink.title,
          type: type,
          currentPosition: currentLink.position,
          previousPosition: previousLink.position,
          change: positionChange,
          sentiment: currentLink.sentiment,
          domain: currentLink.domain
        });
      }
    }
    
    // Find links that disappeared
    for (const previousLink of previousLinks) {
      const currentLink = currentLinks.find(
        cl => cl.link === previousLink.link
      );
      
      if (!currentLink) {
        linkComparisons.push({
          link: previousLink.link,
          title: previousLink.title,
          type: this.comparisonTypes.DISAPPEARED,
          currentPosition: null,
          previousPosition: previousLink.position,
          change: null,
          sentiment: previousLink.sentiment,
          domain: previousLink.domain
        });
      }
    }
    
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




from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import json
import pandas as pd
from datetime import datetime
import threading
import uuid

# Add the python directory to the path so we can import the modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'python'))

# Import the Python modules
from leak_scraper import LeakScraper
from keyword_learner import KeywordLearner
from knowledge_manager import KnowledgeManager

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', '')
SEARCH_ENGINE_ID = os.environ.get('SEARCH_ENGINE_ID', '')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

# Initialize components
keyword_learner = KeywordLearner(OPENAI_API_KEY)
knowledge_manager = KnowledgeManager()

# Store active scans
active_scans = {}

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'google_api': bool(GOOGLE_API_KEY and SEARCH_ENGINE_ID),
        'openai_api': bool(OPENAI_API_KEY),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/suggested-keywords', methods=['GET'])
def get_suggested_keywords():
    """Get suggested keywords for a creator"""
    creator_name = request.args.get('creator')
    if not creator_name:
        return jsonify({'error': 'Creator name is required'}), 400
    
    max_count = int(request.args.get('count', 10))
    
    try:
        keywords = keyword_learner.get_suggested_keywords(creator_name, max_count)
        return jsonify({
            'creator': creator_name,
            'keywords': keywords
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/start-scan', methods=['POST'])
def start_scan():
    """Start a content leak scan"""
    data = request.json
    
    # Validate required fields
    if not data.get('creatorName'):
        return jsonify({'error': 'Creator name is required'}), 400
    
    creator_name = data.get('creatorName')
    content_type = data.get('contentType', 'all')
    keywords = data.get('keywords', [])
    timeframe = data.get('timeframe', 'today')
    max_searches = int(data.get('maxSearches', 50))
    
    # Generate scan ID
    scan_id = str(uuid.uuid4())
    
    # Process timeframe
    if isinstance(timeframe, dict):
        timeframe_str = f"last {timeframe.get('value', 7)} {timeframe.get('type', 'days')}"
    else:
        timeframe_str = timeframe
    
    # Add creator name to each keyword if not already present
    full_keywords = []
    for kw in keywords:
        if creator_name.lower() not in kw.lower():
            full_keywords.append(f"{creator_name} {kw}")
        else:
            full_keywords.append(kw)
    
    # Start scan in background thread
    thread = threading.Thread(
        target=run_scan_thread,
        args=(scan_id, creator_name, full_keywords, timeframe_str, max_searches, content_type)
    )
    thread.daemon = True
    thread.start()
    
    # Store scan info
    active_scans[scan_id] = {
        'id': scan_id,
        'creatorName': creator_name,
        'status': 'running',
        'startTime': datetime.now().isoformat(),
        'progress': 0,
        'contentType': content_type
    }
    
    return jsonify({
        'scanId': scan_id,
        'status': 'running',
        'message': f'Scan started for {creator_name}'
    })

def run_scan_thread(scan_id, creator_name, keywords, timeframe, max_searches, content_type):
    """Run a scan in a background thread"""
    try:
        # Update scan status
        active_scans[scan_id]['status'] = 'running'
        
        # Create and run the scraper
        scraper = LeakScraper(
            creator_name=creator_name,
            api_key=GOOGLE_API_KEY,
            search_engine_id=SEARCH_ENGINE_ID,
            max_searches=max_searches
        )
        
        # Run the scan
        results = scraper.run_scan(
            keywords=keywords,
            timeframe=timeframe
        )
        
        if results:
            # Save temporary results for learning
            temp_dir = os.path.join(os.getcwd(), "temp_results")
            os.makedirs(temp_dir, exist_ok=True)
            temp_file = os.path.join(
                temp_dir,
                f"{creator_name.replace(' ', '_')}_temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            )
            temp_df = pd.DataFrame(results)
            temp_df.to_csv(temp_file, index=False)
            
            # Learn from results
            updated_keywords = keyword_learner.learn_from_results(temp_file, creator_name)
            
            # Update master content repository
            new_count = knowledge_manager.update_master_content(temp_file, creator_name)
            
            # Get content stats
            stats = knowledge_manager.get_content_stats(creator_name)
            
            # Filter results by content type if specified
            if content_type != 'all':
                # This is a simplified content type filter - in a real implementation,
                # you would need more sophisticated content type detection
                if content_type == 'video':
                    video_domains = ['youtube.com', 'vimeo.com', 'tiktok.com', 'twitch.tv']
                    results = [r for r in results if any(d in r['url'] for d in video_domains)]
                elif content_type == 'image':
                    image_domains = ['instagram.com', 'imgur.com', 'flickr.com', 'pinterest.com']
                    results = [r for r in results if any(d in r['url'] for d in image_domains)]
            
            # Update scan status
            active_scans[scan_id] = {
                'id': scan_id,
                'creatorName': creator_name,
                'status': 'completed',
                'startTime': active_scans[scan_id]['startTime'],
                'endTime': datetime.now().isoformat(),
                'results': {
                    'totalMatches': len(results),
                    'domains': list(stats['domains'].keys()),
                    'matches': results
                },
                'stats': {
                    'domainDistribution': [
                        {'id': domain, 'label': domain, 'value': count}
                        for domain, count in stats['domains'].items()
                    ],
                    'contentTypeDistribution': generate_mock_content_type_distribution(results),
                    'confidenceDistribution': generate_mock_confidence_distribution(results),
                    'discoveryTimeline': generate_mock_discovery_timeline(results),
                    'contentAgeDistribution': generate_mock_content_age_distribution()
                }
            }
        else:
            # Update scan status for empty results
            active_scans[scan_id] = {
                'id': scan_id,
                'creatorName': creator_name,
                'status': 'completed',
                'startTime': active_scans[scan_id]['startTime'],
                'endTime': datetime.now().isoformat(),
                'results': {
                    'totalMatches': 0,
                    'domains': [],
                    'matches': []
                },
                'stats': {
                    'domainDistribution': [],
                    'contentTypeDistribution': [],
                    'confidenceDistribution': [],
                    'discoveryTimeline': [],
                    'contentAgeDistribution': []
                }
            }
    except Exception as e:
        # Update scan status on error
        active_scans[scan_id] = {
            'id': scan_id,
            'creatorName': creator_name,
            'status': 'error',
            'startTime': active_scans[scan_id]['startTime'],
            'endTime': datetime.now().isoformat(),
            'error': str(e)
        }

@app.route('/api/scan-status/<scan_id>', methods=['GET'])
def get_scan_status(scan_id):
    """Get the status of a scan"""
    if scan_id not in active_scans:
        return jsonify({'error': 'Scan not found'}), 404
    
    return jsonify(active_scans[scan_id])

@app.route('/api/scan-results/<scan_id>', methods=['GET'])
def get_scan_results(scan_id):
    """Get the results of a completed scan"""
    if scan_id not in active_scans:
        return jsonify({'error': 'Scan not found'}), 404
    
    scan = active_scans[scan_id]
    if scan['status'] != 'completed':
        return jsonify({'error': 'Scan not completed yet', 'status': scan['status']}), 400
    
    return jsonify(scan)

@app.route('/api/scan-stats/<creator_name>', methods=['GET'])
def get_scan_stats(creator_name):
    """Get statistics for a creator's scans"""
    try:
        stats = knowledge_manager.get_content_stats(creator_name)
        
        # Format stats for frontend
        formatted_stats = {
            'totalUrls': stats['total_urls'],
            'dateRange': {
                'oldest': stats['oldest_content'],
                'newest': stats['newest_content']
            },
            'domainDistribution': [
                {'id': domain, 'label': domain, 'value': count}
                for domain, count in stats['domains'].items()
            ],
            'contentTypeDistribution': generate_mock_content_type_distribution([]),
            'confidenceDistribution': generate_mock_confidence_distribution([]),
            'discoveryTimeline': generate_mock_discovery_timeline([]),
            'contentAgeDistribution': generate_mock_content_age_distribution()
        }
        
        return jsonify(formatted_stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export-results/<creator_name>', methods=['GET'])
def export_results(creator_name):
    """Export results for a creator"""
    format_type = request.args.get('format', 'json')
    
    try:
        export_path = knowledge_manager.export_master_data(creator_name, format_type)
        if not export_path:
            return jsonify({'error': 'No data to export'}), 404
        
        # In a real implementation, you would send the file for download
        # For this example, we'll just return the path
        return jsonify({
            'success': True,
            'message': f'Data exported as {format_type}',
            'path': export_path
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Helper functions for generating mock data for visualization
def generate_mock_content_type_distribution(results):
    """Generate mock content type distribution"""
    return [
        {'id': 'video', 'label': 'Video', 'value': max(5, len(results) // 3)},
        {'id': 'image', 'label': 'Image', 'value': max(8, len(results) // 2)},
        {'id': 'text', 'label': 'Text', 'value': max(3, len(results) // 6)}
    ]

def generate_mock_confidence_distribution(results):
    """Generate mock confidence distribution"""
    return [
        {'id': 'high', 'label': 'High', 'value': max(3, len(results) // 4)},
        {'id': 'medium', 'label': 'Medium', 'value': max(5, len(results) // 3)},
        {'id': 'low', 'label': 'Low', 'value': max(2, len(results) // 6)}
    ]

def generate_mock_discovery_timeline(results):
    """Generate mock discovery timeline"""
    # Generate last 30 days of data
    days = 30
    data_points = []
    
    for i in range(days):
        date = datetime.now()
        date = date.replace(day=date.day - (days - i - 1))
        data_points.append({
            'x': date.strftime('%Y-%m-%d'),
            'y': min(5, max(0, (len(results) // 10) * (i % 3)))
        })
    
    return [{'id': 'discoveries', 'data': data_points}]

def generate_mock_content_age_distribution():
    """Generate mock content age distribution"""
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    return [{'month': month, 'count': 3 + (i * 2) % 10} for i, month in enumerate(months)]

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)

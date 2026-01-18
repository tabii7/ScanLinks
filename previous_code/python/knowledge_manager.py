import pandas as pd
import os
from datetime import datetime


class KnowledgeManager:
    def __init__(self):
        """Initialize the knowledge manager"""
        self.master_dir = os.path.join(os.getcwd(), "master_data")
        os.makedirs(self.master_dir, exist_ok=True)

    def update_master_content(self, temp_csv_path, creator_name):
        """Update master content repository with new results"""
        if not os.path.exists(temp_csv_path):
            print("❌ Temp CSV file not found")
            return 0

        # Load the temp CSV with new results
        new_df = pd.read_csv(temp_csv_path)

        # Get master file path
        master_file = os.path.join(self.master_dir, f"{creator_name.replace(' ', '_')}_master.csv")

        # Load existing master file or create new one
        if os.path.exists(master_file):
            master_df = pd.read_csv(master_file)
        else:
            master_df = pd.DataFrame(columns=['title', 'url', 'snippet', 'query', 'page', 'date', 'discovered_date'])

        # Add discovered_date to new records
        new_df['discovered_date'] = datetime.now().strftime('%Y-%m-%d')

        # Check for duplicates based on URL
        new_urls = set(new_df['url'].tolist())
        existing_urls = set(master_df['url'].tolist()) if not master_df.empty else set()
        unique_urls = new_urls - existing_urls

        # Filter to only new records
        unique_df = new_df[new_df['url'].isin(unique_urls)]

        # Append to master file
        if not unique_df.empty:
            combined_df = pd.concat([master_df, unique_df], ignore_index=True)
            combined_df.to_csv(master_file, index=False)
            print(f"✅ Added {len(unique_df)} new records to master content")
            return len(unique_df)
        else:
            print("ℹ️ No new content to add to master repository")
            return 0

    def get_content_stats(self, creator_name):
        """Get statistics about collected content"""
        master_file = os.path.join(self.master_dir, f"{creator_name.replace(' ', '_')}_master.csv")

        if not os.path.exists(master_file):
            return {
                'total_urls': 0,
                'domains': {},
                'newest_content': None,
                'oldest_content': None
            }

        df = pd.read_csv(master_file)

        # Extract domains
        df['domain'] = df['url'].apply(lambda url: url.split('//')[1].split('/')[0] if '//' in url else url)

        # Count domains
        domain_counts = df['domain'].value_counts().to_dict()

        # Get date ranges
        date_stats = {
            'newest_content': df['discovered_date'].max() if 'discovered_date' in df.columns else None,
            'oldest_content': df['discovered_date'].min() if 'discovered_date' in df.columns else None
        }

        stats = {
            'total_urls': len(df),
            'domains': domain_counts,
            'newest_content': date_stats['newest_content'],
            'oldest_content': date_stats['oldest_content']
        }

        return stats

    def export_master_data(self, creator_name, format='csv'):
        """Export master data in different formats"""
        master_file = os.path.join(self.master_dir, f"{creator_name.replace(' ', '_')}_master.csv")

        if not os.path.exists(master_file):
            print("❌ No master data found for export")
            return None

        df = pd.read_csv(master_file)

        if format.lower() == 'csv':
            return master_file
        elif format.lower() == 'excel':
            excel_file = os.path.join(self.master_dir, f"{creator_name.replace(' ', '_')}_master.xlsx")
            df.to_excel(excel_file, index=False)
            return excel_file
        elif format.lower() == 'json':
            json_file = os.path.join(self.master_dir, f"{creator_name.replace(' ', '_')}_master.json")
            df.to_json(json_file, orient='records', indent=2)
            return json_file
        else:
            print(f"❌ Unsupported export format: {format}")
            return None

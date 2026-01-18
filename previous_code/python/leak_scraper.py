import requests
import pandas as pd
import urllib.parse
import time
import json
import os
from datetime import datetime


class LeakScraper:
    def __init__(self, creator_name, api_key, search_engine_id, max_searches=100):
        """
        Initialize a leak scraper with adaptive batch sizing

        Args:
            creator_name: The creator to search for
            api_key: Google Custom Search API key
            search_engine_id: Google Custom Search Engine ID
            max_searches: Maximum API calls to make
        """
        self.creator_name = creator_name
        self.api_key = api_key
        self.search_engine_id = search_engine_id
        self.max_searches = max_searches
        self.api_calls = 0

        # Create output directory
        self.base_dir = os.path.join(os.getcwd(), "leak_detection_results")
        os.makedirs(self.base_dir, exist_ok=True)

        # Default output file
        self.output_file = os.path.join(self.base_dir, f"{creator_name.replace(' ', '_')}_results.csv")

        # Track URLs to avoid duplicates
        self.unique_urls = set()

        # Load existing results if file exists
        self.load_existing_results()

    def load_existing_results(self):
        """Load previously discovered URLs to avoid duplicates"""
        try:
            if os.path.exists(self.output_file):
                df = pd.read_csv(self.output_file)
                self.unique_urls = set(df['url'].tolist())
                print(f"✅ Loaded {len(self.unique_urls)} previously found URLs")
        except Exception as e:
            print(f"ℹ️ No previous results loaded: {e}")

    def adaptive_batch_keywords(self, keywords, max_batch_size=1):
        """Group keywords into batches with maximum 1 keywords per batch"""
        # Always create batches with max 2 keywords per batch
        return [keywords[i:i + max_batch_size] for i in range(0, len(keywords), max_batch_size)]

    def build_query(self, keyword_batch):
        """Build an optimized query from a batch of keywords"""
        query_parts = []

        for keyword in keyword_batch:
            # Check if the keyword already has quotes
            if keyword.startswith('"') and keyword.endswith('"'):
                query_parts.append(keyword)
            elif "site:" in keyword:
                # Don't add quotes to site-specific searches
                query_parts.append(keyword)
            else:
                # Add quotes for exact phrase matching
                query_parts.append(keyword)

        # Join with OR operator
        query = " OR ".join(query_parts)
        return query

    def get_date_restrict(self, timeframe):
        """Convert user timeframe to API date_restrict parameter"""
        if timeframe == "today":
            return "d1"
        elif timeframe == "lifetime":
            return ""  # No date restriction for all time
        elif "days" in timeframe:
            days = int(timeframe.split()[1])
            return f"d{days}"
        elif "weeks" in timeframe:
            weeks = int(timeframe.split()[1])
            days = weeks * 7
            return f"d{days}"
        elif "months" in timeframe:
            months = int(timeframe.split()[1])
            days = months * 30
            return f"d{days}"
        else:
            # Default to last 30 days
            return "d30"

    def search_batch(self, keyword_batch, date_restrict, max_pages=10):
        """Search for a batch of keywords with pagination"""
        # Build combined query
        query = self.build_query(keyword_batch)
        encoded_query = urllib.parse.quote(query)

        print(f"\n🔍 Searching batch: {' | '.join(keyword_batch[:3])}...")
        if len(keyword_batch) > 3:
            print(f"   ...and {len(keyword_batch) - 3} more keywords")
        print(f"   Query: {query[:100]}..." if len(query) > 100 else f"   Query: {query}")

        # Store results
        batch_results = []

        # Search with pagination
        for page in range(1, max_pages + 1):
            # Check if we've hit our search limit
            if self.api_calls >= self.max_searches:
                print(f"⚠️ Reached search limit ({self.api_calls}/{self.max_searches})")
                return batch_results

            # Calculate start index for pagination
            start_index = ((page - 1) * 10) + 1

            # Build URL parameters
            url_params = [
                f"q={encoded_query}",
                f"cx={self.search_engine_id}",
                f"key={self.api_key}",
                "num=10",  # Always 10 (API limit)
                f"start={start_index}"
            ]

            # Add date restriction only if specified (not empty for lifetime)
            if date_restrict:
                url_params.append(f"dateRestrict={date_restrict}")

            # ALWAYS add exactTerms to ensure creator name is present
            url_params.append(f"exactTerms={self.creator_name}")

            # Build final URL
            api_url = f"https://www.googleapis.com/customsearch/v1?{'&'.join(url_params)}"

            try:
                print(f"   📄 Page {page}/{max_pages}...")
                response = requests.get(api_url)
                self.api_calls += 1
                data = response.json()

                # Handle API errors
                if "error" in data:
                    error_msg = data["error"].get("message", "Unknown error")
                    print(f"   ⚠️ API error: {error_msg}")

                    # Check for quota exceeded errors
                    if "quota" in error_msg.lower():
                        print("❌ API quota exceeded! Stopping searches.")
                        return batch_results

                    time.sleep(2)  # Wait longer if we hit an error
                    continue

                if "items" in data:
                    result_count = len(data["items"])
                    new_count = 0
                    print(f"\n   📋 Page {page} Results:")

                    for i, item in enumerate(data["items"], 1):
                        title = item.get("title", "")
                        link = item.get("link", "")
                        snippet = item.get("snippet", "")

                        # Show all links in terminal
                        is_new = link not in self.unique_urls
                        status = "🆕" if is_new else "📎"
                        print(f"   {status} {i}. {title[:50]}... - {link}")

                        # Only add if it's a new URL
                        if is_new:
                            batch_results.append({
                                "title": title,
                                "url": link,
                                "snippet": snippet,
                                "query": str(keyword_batch),
                                "page": page,
                                "date": datetime.now().strftime('%Y-%m-%d')
                            })
                            self.unique_urls.add(link)
                            new_count += 1

                    print(f"\n   ✅ Found {result_count} results, {new_count} new URLs")

                    # If we do not find new results on a new page
                    if result_count == 0:
                        print("   ℹ️ No more results available")
                        break
                else:
                    print("   ⚠️ No results found on this page")
                    break  # No need to check more pages

                # Respect API rate limits
                time.sleep(2)

            except Exception as e:
                print(f"   ⚠️ Error: {e}")
                time.sleep(2)

        return batch_results

    def run_scan(self, keywords, timeframe, max_searches=None):
        """Run a scan with user-provided keywords and timeframe"""
        if max_searches is not None:
            self.max_searches = max_searches

        print(f"\n🚀 Starting leak scan for: {self.creator_name}")
        print(f"📅 Timeframe: {timeframe}")
        print(f"🔢 Search budget: {self.max_searches} API calls")
        print(f"🔍 Using {len(keywords)} keywords: {keywords}")

        # Reset API calls counter
        self.api_calls = 0

        # Convert timeframe to date_restrict parameter
        date_restrict = self.get_date_restrict(timeframe)
        print(f"ℹ️ Converted timeframe to date parameter: {date_restrict or 'No date restriction (All Time)'}")

        # Group keywords into appropriately sized batches
        batches = self.adaptive_batch_keywords(keywords)
        print(f"ℹ️ Created {len(batches)} batches of keywords")

        # Store all results
        all_results = []

        # Process each batch
        for batch_num, keyword_batch in enumerate(batches, 1):
            # Check if we've hit our search limit
            if self.api_calls >= self.max_searches:
                print(f"⚠️ Reached search limit ({self.api_calls}/{self.max_searches})")
                break

            print(f"\n🔍 Processing batch {batch_num}/{len(batches)}")

            # Search this batch with pagination
            batch_results = self.search_batch(keyword_batch, date_restrict)
            all_results.extend(batch_results)

            # Show progress
            print(
                f"Progress: {self.api_calls}/{self.max_searches} API calls used ({self.api_calls / self.max_searches * 100:.1f}%)")
            print(f"Found {len(all_results)} unique URLs so far")

            # Save results after each batch
            self.save_results(all_results)

        print(f"\n✅ Scan complete! Results saved to {self.output_file}")
        print(f"🔢 API calls used: {self.api_calls}/{self.max_searches}")
        print(f"🔗 Unique URLs found: {len(all_results)}")

        # Print summary of top domains
        self.print_domain_summary(all_results)

        return all_results

    def print_domain_summary(self, results):
        """Print a summary of the top domains found"""
        if not results:
            return

        # Extract domains from URLs
        domains = []
        for result in results:
            url = result['url']
            try:
                # Extract domain from URL
                domain = url.split('//')[1].split('/')[0]
                domains.append(domain)
            except:
                pass

        # Count domains
        domain_counts = {}
        for domain in domains:
            if domain in domain_counts:
                domain_counts[domain] += 1
            else:
                domain_counts[domain] = 1

        # Sort by count
        sorted_domains = sorted(domain_counts.items(), key=lambda x: x[1], reverse=True)

        # Print top domains
        print("\n📊 Top Domains with Content:")
        for i, (domain, count) in enumerate(sorted_domains[:10], 1):
            print(f"   {i}. {domain}: {count} URLs")

    def save_results(self, results):
        """Save results to CSV file"""
        if not results:
            print("⚠️ No results to save")
            return

        df = pd.DataFrame(results)
        df.to_csv(self.output_file, index=False)
        print(f"✅ Saved {len(results)} results to {self.output_file}")

    def save_temp_results(self, results, creator_name):
        """Save results to a temporary CSV for learning"""
        temp_dir = os.path.join(os.getcwd(), "temp_results")
        os.makedirs(temp_dir, exist_ok=True)

        temp_file = os.path.join(temp_dir,
                                 f"{creator_name.replace(' ', '_')}_temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")

        if not results:
            return None

        df = pd.DataFrame(results)
        df.to_csv(temp_file, index=False)
        print(f"✅ Saved temp results to {temp_file} for keyword learning")

        return temp_file

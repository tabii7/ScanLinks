import os
import argparse
import pandas as pd
from datetime import datetime
from leak_scraper import LeakScraper
from keyword_learner import KeywordLearner
from knowledge_manager import KnowledgeManager


def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='ORM Leak Detection System')
    parser.add_argument('--creator', type=str, help='Creator name to search for')
    parser.add_argument('--timeframe', type=str, help='Timeframe (today, last X days/weeks/months)')
    parser.add_argument('--max-searches', type=int, help='Maximum API calls')
    parser.add_argument('--suggest-only', action='store_true', help='Only suggest keywords without searching')
    parser.add_argument('--export', choices=['csv', 'excel', 'json'], help='Export master data in specified format')

    args = parser.parse_args()

    # Configuration
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', '')
    SEARCH_ENGINE_ID = os.environ.get('SEARCH_ENGINE_ID', '')
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

    # Initialize components
    keyword_learner = KeywordLearner(OPENAI_API_KEY)
    knowledge_manager = KnowledgeManager()

    # Get creator name
    creator_name = args.creator
    if not creator_name:
        creator_name = input("Enter creator name: ").strip()
        if not creator_name:
            creator_name = "Kaylee Killion"  # Default
            print(f"Using default creator: {creator_name}")

    # Handle export request if specified
    if args.export:
        export_path = knowledge_manager.export_master_data(creator_name, args.export)
        if export_path:
            print(f"✅ Exported master data to: {export_path}")
        return

    # Get suggested keywords from previous learning
    suggested_keywords = keyword_learner.get_suggested_keywords(creator_name)

    if suggested_keywords:
        print("\n📊 Suggested keywords based on previous scans:")
        for i, kw in enumerate(suggested_keywords[:10], 1):
            print(f"  {i}. {kw}")

    if args.suggest_only:
        print("\nSuggested keywords only mode - exiting without search")
        return

    # Get user keywords
    print("\n🔎 Enter keywords to search for (1-10 keywords):")
    print("Example: OnlyFans leaks, private photos, nudes")
    if suggested_keywords:
        print("Or press Enter to use suggested keywords")

    user_input = input("> ").strip()

    if not user_input and suggested_keywords:
        # Use suggested keywords if user doesn't provide any
        USER_KEYWORDS = suggested_keywords[:10]
        print(f"Using {len(USER_KEYWORDS)} suggested keywords")
    else:
        # Parse user keywords
        if not user_input:
            print("⚠️ Please enter at least one keyword")
            return

        # Split by commas and clean up
        USER_KEYWORDS = [k.strip() for k in user_input.split(',')]
        USER_KEYWORDS = [k for k in USER_KEYWORDS if k]

        if not USER_KEYWORDS:
            print("⚠️ Please enter at least one valid keyword")
            return

        if len(USER_KEYWORDS) > 10:
            print("⚠️ Maximum 10 keywords allowed. Using the first 10.")
            USER_KEYWORDS = USER_KEYWORDS[:10]

    # Get timeframe - ALWAYS prompt for this
    TIMEFRAME = args.timeframe
    if not TIMEFRAME:
        TIMEFRAME = get_user_timeframe()

    # Get API call limit - ALWAYS prompt for this
    MAX_SEARCHES = args.max_searches
    if not MAX_SEARCHES:
        try:
            MAX_SEARCHES = int(input("\n🔢 Enter max search API calls (default: 50): ") or "50")
        except ValueError:
            MAX_SEARCHES = 50
            print(f"Invalid input. Using default: {MAX_SEARCHES}")

    # Add creator name to each keyword
    FULL_KEYWORDS = [f"{creator_name} {kw}" for kw in USER_KEYWORDS]

    # Create and run the scraper
    scraper = LeakScraper(
        creator_name=creator_name,
        api_key=GOOGLE_API_KEY,
        search_engine_id=SEARCH_ENGINE_ID,
        max_searches=MAX_SEARCHES
    )

    # Run the scan
    results = scraper.run_scan(
        keywords=FULL_KEYWORDS,
        timeframe=TIMEFRAME
    )

    if results:
        # Save temporary results for learning
        temp_dir = os.path.join(os.getcwd(), "temp_results")
        os.makedirs(temp_dir, exist_ok=True)
        temp_file = os.path.join(temp_dir,
                                 f"{creator_name.replace(' ', '_')}_temp_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        temp_df = pd.DataFrame(results)
        temp_df.to_csv(temp_file, index=False)
        print(f"✅ Saved temp results to {temp_file} for keyword learning")

        # Learn from results
        print("\n🧠 Learning from search results...")
        updated_keywords = keyword_learner.learn_from_results(temp_file, creator_name)

        # Update master content repository
        print("\n📚 Updating master content repository...")
        new_count = knowledge_manager.update_master_content(temp_file, creator_name)

        # Show content stats
        stats = knowledge_manager.get_content_stats(creator_name)
        print(f"\n📈 Content Repository Stats:")
        print(f"  Total URLs: {stats['total_urls']}")
        print(f"  Date Range: {stats['oldest_content']} to {stats['newest_content']}")
        print(f"  Top Domains:")
        domain_items = list(stats['domains'].items())
        domain_items.sort(key=lambda x: x[1], reverse=True)
        for domain, count in domain_items[:5]:
            print(f"    - {domain}: {count} URLs")

    print("\n✅ Process complete!")


def get_user_timeframe():
    """Get timeframe from user input"""
    print("\n⏱️ Select timeframe:")
    print("1. Today")
    print("2. Last X days")
    print("3. Last X weeks")
    print("4. Last X months")

    while True:
        choice = input("Enter choice (1-4): ").strip()

        if choice == "1":
            return "today"
        elif choice in ["2", "3", "4"]:
            if choice == "2":
                unit = "days"
                default = "7"
            elif choice == "3":
                unit = "weeks"
                default = "1"
            else:
                unit = "months"
                default = "1"

            number = input(f"Enter number of {unit} (default: {default}): ").strip()

            if not number:
                number = default

            try:
                number = int(number)
                if number <= 0:
                    print("⚠️ Please enter a positive number")
                    continue

                return f"last {number} {unit}"
            except ValueError:
                print("⚠️ Please enter a valid number")
                continue
        else:
            print("⚠️ Please enter a number between 1 and 4")


if __name__ == "__main__":
    main()

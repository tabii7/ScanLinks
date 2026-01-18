import pandas as pd
import openai
import nltk
from nltk.tokenize import word_tokenize
from collections import Counter
import os
import json
from datetime import datetime
import ast


class KeywordLearner:
    def __init__(self, openai_api_key):
        """Initialize the keyword learner"""
        self.openai_client = openai.OpenAI(api_key=openai_api_key)
        self.keyword_db_path = os.path.join(os.getcwd(), "knowledge_base")
        os.makedirs(self.keyword_db_path, exist_ok=True)

        # Download NLTK resources
        nltk.download("punkt", quiet=True)

    def learn_from_results(self, temp_csv_path, creator_name):
        """Learn keywords from scraped results"""
        if not os.path.exists(temp_csv_path):
            print("❌ Temp CSV file not found")
            return []

        print(f"📊 Analyzing results from {temp_csv_path}")

        # Load the temp CSV with scraped results
        df = pd.read_csv(temp_csv_path)

        # Extract text for analysis
        text_corpus = []
        for _, row in df.iterrows():
            text_corpus.append(row.get('title', ''))
            text_corpus.append(row.get('snippet', ''))

        full_text = " ".join([t for t in text_corpus if isinstance(t, str)])

        print(f"📝 Extracted {len(text_corpus)} text elements for analysis")

        # Extract potential keywords with NLTK
        extracted_keywords = self._extract_keywords(full_text)
        print(f"🔍 Extracted {len(extracted_keywords)} candidate keywords")

        # Generate optimized keywords with AI
        ai_keywords = self._generate_ai_keywords(df, extracted_keywords, creator_name)
        print(f"🧠 Generated {len(ai_keywords)} AI-optimized keywords")

        # Update keywords database
        updated_keywords = self._update_keyword_database(ai_keywords, creator_name)

        return updated_keywords

    def _extract_keywords(self, text):
        """Extract potential keywords from text"""
        # Tokenize and count word frequencies
        words = word_tokenize(text.lower())

        # Filter non-alphabetic words and short words
        filtered_words = [word for word in words if word.isalpha() and len(word) > 3]
        word_counts = Counter(filtered_words)

        # Get words appearing multiple times
        extracted_keywords = [word for word, count in word_counts.most_common(50) if count > 1]

        return extracted_keywords

    def _generate_ai_keywords(self, df, extracted_keywords, creator_name):
        """Generate keywords using AI"""
        # Prepare data for OpenAI
        csv_text = df.to_string(index=False, max_rows=30)

        # Load existing keywords from database if available
        existing_keywords = self._get_existing_keywords(creator_name)
        existing_keywords_text = ", ".join(
            existing_keywords[:15]) if existing_keywords else "No previous keywords available"

        prompt = f"""
        **Role: You are a Search Intelligence Analyst specializing in finding leaked content.**

        We need to generate optimal search keywords for finding leaked content of creator "{creator_name}".

        **PREVIOUSLY SUCCESSFUL KEYWORDS:**
        {existing_keywords_text}

        **EXTRACTED FREQUENT WORDS:**
        {extracted_keywords[:30]}

        **SAMPLE CONTENT:**
        {csv_text[:2000]}

        **YOUR TASK:**
        - Analyze the content to identify keywords that would find more leaked content
        - Generate ONLY 8-10 search keywords with highest probability of finding leaked content
        - Each keyword should focus on finding unauthorized/leaked content
        - Focus on NSFW/adult terms that appear to be associated with leaked content
        - Include terms for file types, platforms, or specific content types
        - Do NOT include the creator's name in the keywords (it will be added separately)

        **FINAL OUTPUT:**
        Return only a properly formatted Python list of 8-10 keywords, no explanations.
        Example: ["leaked onlyfans", "nude photos", "explicit content", "private video"]
        """

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=400
            )

            generated_text = response.choices[0].message.content.strip()
            print("📋 AI response received")

            # Process the response to extract keywords
            try:
                # Clean up the list format
                clean_text = generated_text.replace('\n', ' ')

                # Find the list part
                start_idx = clean_text.find('[')
                end_idx = clean_text.rfind(']')

                if start_idx != -1 and end_idx != -1:
                    list_text = clean_text[start_idx:end_idx + 1]
                    # Convert string representation to actual list
                    keywords = ast.literal_eval(list_text)
                    return keywords
                else:
                    # Fallback if list format not found
                    return self._extract_fallback_keywords(generated_text)

            except Exception as e:
                print(f"❌ Error parsing AI keywords: {e}")
                print("🔄 Using fallback keyword extraction")
                return self._extract_fallback_keywords(generated_text)

        except Exception as e:
            print(f"❌ Error generating AI keywords: {e}")
            return []

    def _extract_fallback_keywords(self, text):
        """Extract keywords from text as fallback"""
        # Simple extraction based on line breaks and quotes
        keywords = []
        for line in text.split('\n'):
            line = line.strip()
            if line and len(line) > 4 and not line.startswith('#'):
                # Extract anything in quotes
                if '"' in line:
                    parts = line.split('"')
                    for i in range(1, len(parts), 2):
                        if parts[i].strip():
                            keywords.append(parts[i].strip())
                # Or just take the whole line if it's short
                elif len(line) < 30 and not line.startswith('[') and not line.endswith(']'):
                    keywords.append(line)

        # Deduplicate and return max 10
        return list(set(keywords))[:10]

    def _get_existing_keywords(self, creator_name):
        """Get existing keywords from database"""
        db_file = os.path.join(self.keyword_db_path, f"{creator_name.replace(' ', '_')}_keywords.json")

        if not os.path.exists(db_file):
            return []

        try:
            with open(db_file, 'r') as f:
                keyword_data = json.load(f)

            # Sort by familiarity index (occurrence count)
            sorted_keywords = sorted(keyword_data.items(), key=lambda x: x[1]['occurrence'], reverse=True)
            return [k for k, v in sorted_keywords]
        except Exception as e:
            print(f"❌ Error loading existing keywords: {e}")
            return []

    def _update_keyword_database(self, ai_keywords, creator_name):
        """Update keyword database with new keywords"""
        db_file = os.path.join(self.keyword_db_path, f"{creator_name.replace(' ', '_')}_keywords.json")

        # Load existing database or create new one
        if os.path.exists(db_file):
            try:
                with open(db_file, 'r') as f:
                    keyword_data = json.load(f)
            except Exception as e:
                print(f"❌ Error reading keyword database: {e}")
                keyword_data = {}
        else:
            keyword_data = {}

        # Update occurrence counts for keywords
        current_date = datetime.now().strftime('%Y-%m-%d')

        for keyword in ai_keywords:
            keyword = keyword.lower().strip()
            if keyword in keyword_data:
                # Update existing keyword
                keyword_data[keyword]['occurrence'] += 1
                keyword_data[keyword]['last_seen'] = current_date
            else:
                # Add new keyword
                keyword_data[keyword] = {
                    'occurrence': 1,
                    'first_seen': current_date,
                    'last_seen': current_date
                }

        # Save updated database
        with open(db_file, 'w') as f:
            json.dump(keyword_data, f, indent=2)

        print(f"✅ Updated keyword database with {len(ai_keywords)} keywords")

        # Return all keywords sorted by occurrence
        sorted_keywords = sorted(keyword_data.items(), key=lambda x: x[1]['occurrence'], reverse=True)
        return [k for k, v in sorted_keywords]

    def get_suggested_keywords(self, creator_name, max_count=10):
        """Get suggested keywords for next search"""
        keywords = self._get_existing_keywords(creator_name)

        # Return top keywords from database
        if keywords:
            return keywords[:max_count]
        else:
            # Fallback to basic suggestions if no keywords in database
            return [
                "onlyfans leaks",
                "leaked content",
                "private photos",
                "nude leaks",
                "xxx content"
            ]

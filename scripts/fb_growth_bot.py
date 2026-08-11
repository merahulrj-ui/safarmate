import time
import re
import sys
from playwright.sync_api import sync_playwright

# ------------------------------------------------------------------
# 1. SETUP & CONFIGURATION
# ------------------------------------------------------------------
FB_EMAIL = 'YOUR_FACEBOOK_EMAIL'
FB_PASSWORD = 'YOUR_FACEBOOK_PASSWORD'

# The Target Group URL (Must use mbasic.facebook.com for easy scraping)
# Example: https://mbasic.facebook.com/groups/123456789/
GROUP_URL = 'https://mbasic.facebook.com/groups/YOUR_GROUP_ID/'

# The message you want to post automatically
PROMO_MESSAGE = (
    "Hi! If you are travelling today, check out SafarMate. "
    "It's a 100% Ad-Free carpooling app with Zero Booking Fees. "
    "Download here: https://safarmate.example.com"
)

# Keywords to look for in a post to decide if we should comment
KEYWORDS = ["need a ride", "looking for ride", "delhi to", "chandigarh", "passenger"]

# Delay (in seconds) between comments to avoid getting BANNED!
# Facebook bans bots that comment too fast. 300 seconds = 5 minutes.
COMMENT_DELAY = 300  

def log(msg):
    print(f"[BOT] {msg}")

def check_keywords(text):
    text_lower = text.lower()
    for kw in KEYWORDS:
        if kw.lower() in text_lower:
            return True
    return False

def run_bot():
    if FB_EMAIL == 'YOUR_FACEBOOK_EMAIL':
        print("ERROR: Please edit fb_growth_bot.py and set your FB_EMAIL and FB_PASSWORD first!")
        sys.exit(1)

    with sync_playwright() as p:
        log("Launching browser...")
        # Headless=False so you can see what it's doing. Set to True to run invisibly.
        browser = p.chromium.launch(headless=False) 
        context = browser.new_context()
        page = context.new_page()

        try:
            # 1. Login
            log("Opening Facebook Login...")
            page.goto('https://mbasic.facebook.com/')
            
            page.fill('input[name="email"]', FB_EMAIL)
            page.fill('input[name="pass"]', FB_PASSWORD)
            page.click('input[name="login"]')
            
            # Wait a bit for login to complete
            page.wait_for_timeout(3000)
            
            # Click "Not Now" if it asks to save password
            if page.locator("text=Not Now").count() > 0:
                page.click("text=Not Now")
                
            log("Logged in successfully!")

            # 2. Go to the Group
            log(f"Navigating to group: {GROUP_URL}")
            page.goto(GROUP_URL)

            # 3. Scan for posts
            # In mbasic, posts are usually inside tables or divs with role="article"
            # Since mbasic structure changes, we find all "Comment" links
            
            comment_links = page.locator('a:has-text("Comment")').all()
            log(f"Found {len(comment_links)} posts with comment options on this page.")

            # To avoid spamming, we will just comment on ONE matching post per run, 
            # or you can loop through them.
            commented_count = 0
            
            for i in range(len(comment_links)):
                if commented_count > 0:
                    break # Only do 1 comment per run to be safe!
                
                # We need to get the text of the post. 
                # On mbasic, the text is usually just preceding the comment link.
                # Let's grab the whole page text to keep it simple, or navigate to the comment page first.
                
                href = comment_links[i].get_attribute('href')
                if not href:
                    continue
                    
                log("Opening a post to read its content...")
                # We open the comment link in a new page/tab to not lose our place
                post_page = context.new_page()
                post_page.goto(f"https://mbasic.facebook.com{href}" if not href.startswith("http") else href)
                
                # Check if it has our keywords
                body_text = post_page.locator('body').inner_text()
                if check_keywords(body_text):
                    log("Keyword Match Found! Preparing to comment...")
                    
                    # Find comment input
                    if post_page.locator('textarea[name="comment_text"]').count() > 0:
                        post_page.fill('textarea[name="comment_text"]', PROMO_MESSAGE)
                        post_page.click('input[value="Comment"]')
                        log("Comment Posted Successfully!")
                        commented_count += 1
                        
                        log(f"Sleeping for {COMMENT_DELAY} seconds to prevent ban...")
                        time.sleep(COMMENT_DELAY)
                    else:
                        log("Could not find comment box (comments might be turned off).")
                else:
                    log("No matching keywords in this post. Skipping.")
                
                post_page.close()
                time.sleep(2) # Small delay between checking posts

            log("Finished scanning this page.")

        except Exception as e:
            log(f"An error occurred: {e}")
        finally:
            log("Closing browser...")
            browser.close()

if __name__ == "__main__":
    run_bot()

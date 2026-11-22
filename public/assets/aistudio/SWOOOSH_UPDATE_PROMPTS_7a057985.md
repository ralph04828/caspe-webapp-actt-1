# SWOOOSH — UPDATE PROMPTS (open community, chat, MyDay, no AI)

How to use: paste these into the same AI Studio project, ONE STEP AT A TIME, in order. Test each step in the preview before pasting the next. After each step, test with TWO different Google accounts (one on your phone, one on your laptop or a classmate's phone), because this is a social app.

Paste this line before every step:
"Keep everything that already works. Only change what this step describes. Do not break existing pages, styling, or data."

---

# STEP 1 — REMOVE SWOOOSH AI (simplify the app)

Remove SWOOOSH AI completely. Fashion creativity should come from the people, not from AI.

- Delete the SWOOOSH AI page, its sidebar and tab-bar item, and all routes, components and services that belong to it.
- Remove every Gemini call: outfit generator, style recommendations, color matching, outfit feedback, fashion chat, missing-piece suggestions, auto-tagging on upload, AI remix, and the daily AI suggestion card.
- Remove the AI daily quota and rate-limit code, the "AI requests left today" counters on the Overview, and any Gemini API key or environment variable.
- Remove the Express server routes that only exist for AI. If nothing else needs the server, remove the server and make the app a normal Firebase app (Auth + Firestore). Keep a server only if a remaining feature truly needs it, and tell me which one.
- Keep these manual versions: "Swap one piece" on an outfit (pick a replacement yourself from your wardrobe) and "Remix this fit" as a manual tool where you pick your own matching pieces from your wardrobe, with credit to the original creator.
- Keep the weather card (Open-Meteo) as plain information, with no AI.
- Remove the words "AI stylist" and "SWOOOSH AI" from the tagline, login page, About text, page titles and meta descriptions. The new description is: "SWOOOSH is a fashion social network: share your fits, build your wardrobe, plan your outfits, and connect with friends."
- Clean up unused code and dependencies so the app is simpler and faster.

Test: no AI page or button anywhere, no errors in the console, and everything else still works.

---

# STEP 2 — OPEN COMMUNITY (everyone who signs up can find each other)

Make SWOOOSH an open community where anyone can create an account and everyone can discover each other.

- **Easy sign-up:** anyone can create an account with Google Sign-In (and email/password if available). After the first sign-in, show a short onboarding screen: choose a unique username, display name, profile photo, and a short bio. Confirm the user is 13 or older.
- **Public profiles by default.** Every new account is discoverable. Users can switch their profile to Private in Settings.
- **Find people:** a "People" search page and a search bar to find users by username or name. Show a "Suggested people" list and "New members" list. Each result shows avatar, username, and an **Add Friend** button.
- **Friends system:**
  - Add Friend sends a request. The other person gets a notification and can Accept or Decline.
  - Accepted users become **friends**. Show a Friends list on the profile, a Friend Requests inbox, and Remove Friend and Cancel Request actions.
  - Also keep **Follow** for public accounts, so people can follow someone's fits without being friends.
- **Profile pages:** avatar, username, bio, friend count, follower count, tabs for Posts (OOTD and fits), Wardrobe, Lookbook, and MyDay. Buttons: Add Friend / Friends / Message / Follow / Block / Report.
- **Visibility still applies:** Public, Friends only, and Private on each post, item and outfit. The Outfit Planner, Laundry, Wear logs and Stats stay private.
- Update Firestore Security Rules so signed-in users can read public profiles and public content, friends can read friends-only content, and nobody can read someone else's private data or edit anything that isn't theirs.

Test: with two accounts, create both accounts, find each other by username, send and accept a friend request, and see each other's public profile.

---

# STEP 3 — POST FROM ANYWHERE (feed, OOTD, wardrobe, lookbook, planner)

Make posting available everywhere, and make the Home feed show what people post.

**A big "Create / Post" button (always visible)** with these options:
- Post an OOTD (photo of what I'm wearing, with caption and tags)
- Post a fit (from my Lookbook)
- Post a clothing item (from my Wardrobe)
- Post my planned outfit (from my Planner)
- Add to MyDay (Step 4)

**A "Post" or "Share" button on every feature:**
- **OOTD:** a dedicated OOTD page and posting flow. Upload a photo, add a caption, style tags and season, choose visibility (Public / Friends / Private), optionally link it to a saved outfit.
- **Home Feed:** the feed shows posts. Tabs: **Everyone** (all public posts), **Friends** (friends and people I follow), and **Mine**. Newest first, "Load more", pull-to-refresh, skeleton loaders, and an empty state.
- **My Wardrobe:** I can add my own fits and clothes directly, and every item has a "Post this" button that creates a feed post from it. An item can be public, friends only, or private.
- **My Lookbook:** every outfit has a "Post to feed" button, and posting stays optional.
- **Outfit Planner:** stays private by default. Add an optional "Share today's outfit" or "Share this planned outfit" button that makes a copy of that outfit as a post. Sharing creates a separate post, so the planner itself is never exposed and deleting the post doesn't delete the plan.

**Every post shows:** avatar, username, photo(s), caption, tags, time, like, comment, save, and share. Posts support multiple photos, editing the caption, and deleting. Comments support replies and deleting your own comments.

**Rules:** no prices, no shopping links, no "buy" buttons anywhere. Posts about clothing show style and people only.

Test: from account A, post an OOTD, a wardrobe item and a lookbook outfit. On account B, find them in the Everyone feed. Add A as a friend and post a friends-only post and confirm only friends can see it.

---

# STEP 4 — MYDAY (24-hour stories)

Add **MyDay**, like Instagram or Facebook Stories.

- A row of circular avatars at the top of the Home feed. The first circle is "Your MyDay" with a plus button. Friends and followed people with an active MyDay show a highlighted ring, and the ring changes once viewed.
- Add a MyDay: pick or take a photo (camera-first on phones), optionally add a text caption and a style tag, choose who sees it (Public / Friends only / Close friends optional), then post.
- A full-screen viewer: tap to go to the next item, swipe or tap to go back, a progress bar at the top, a pause on hold, close with a button and the Escape key. Show the poster's name and the time posted.
- A MyDay **expires 24 hours after posting.** Store an `expiresAt` time on each one and only show items that haven't expired. If Firestore's TTL (automatic delete) is available in the project, set it up; otherwise delete expired items when the owner opens the app. Do not use Cloud Functions.
- The owner sees a viewers list for each MyDay. The owner can delete a MyDay early.
- Viewers can react with an emoji or reply with a message, which goes to the owner as a chat message (see Step 5).
- Respect visibility, blocks and mutes. Blocked people never see or get notified.

Test: post a MyDay on account A. Account B (a friend) sees the ring, views it, and A sees B in the viewers list. After 24 hours it disappears (you can test by temporarily setting a short expiry).

---

# STEP 5 — CHAT (Discord-style messaging)

Add real-time chat so friends can actually talk inside SWOOOSH, like Messenger or Discord.

**Direct messages**
- A **Messages** page (and a message icon with an unread badge in the header) with a conversation list and a chat window.
- Friends can start a conversation with the **Message** button on a profile. Messages appear instantly for both people using Firestore real-time listeners (no refreshing).
- Features: text, emoji, photo sending (compressed), reply to a message, delete my own message, "seen" status, typing indicator, and timestamps. Messages from a MyDay reply and from a shared post appear in the same chat.

**Group chats and rooms (Discord-style)**
- Create a group chat with several friends: name, photo, add or remove members, leave group.
- **Rooms:** create a themed room or "server" with channels (for example "#ootd-of-the-day", "#thrift-finds", "#streetwear", "#school-fits"). A room has an owner, optional moderators, an invite link, and a member list. Rooms can be public (anyone can join) or invite-only.
- Messages in a channel update in real time and show the sender's avatar and name.
- Room owners and moderators can delete messages and remove members.

**Online status**
- Show a green dot for friends who are online and "last seen" otherwise. Users can turn this off in Settings.

**Notifications**
- In-app notifications for new messages, friend requests, and mentions (@username). Unread counts on the Messages icon.

**Safety (required, since strangers can now talk)**
- People who aren't friends cannot DM you. Rooms are the only place strangers can talk, and only if they chose to join.
- Block, mute, report a message, report a user, and leave a room, from every chat. Blocked users cannot message or see the blocker.
- Basic bad-word and spam filtering, a rate limit on messages (for example 20 per minute), and a message length limit.
- A report queue stored in Firestore for admin review. Rules about harassment, body-shaming, hate, nudity and spam are shown on first use of chat.

**Security rules:** only members of a conversation or room can read or write its messages. Users cannot edit or delete other people's messages, and can't write a message as someone else.

**Voice and video calls:** not included in this step. They need extra services. Show a disabled "Calls (coming later)" label only if it fits the design, and do not fake it.

**Cost note:** real-time chat uses many Firestore reads. Load only the latest 30 messages and "Load older" on scroll, detach listeners when a chat is closed, and show a clear error if the free usage limit is reached.

Test: on two accounts, become friends, send messages both ways and watch them appear instantly. Create a room, join it with account B, and post in a channel.

---

# STEP 6 — MAKE IT EASY FOR EVERYONE TO USE (reach and accessibility)

- **Easy sharing:** a "Copy invite link" in Settings and on profiles (a link to my profile page that works for people who aren't signed in and asks them to sign up). A "Join SWOOOSH" page with a short intro and a Sign in with Google button.
- **First-time experience:** a quick onboarding that asks the user to add a profile photo, post their first OOTD, and add 3 friends or follow 3 people. Show a friendly empty state with "Find people" until they do.
- **Works on any phone:** fast on slow connections (lazy-load images, small thumbnails), installable as an app (PWA), and good with one hand on mobile.
- **Accessibility basics:** alt text on every image (the poster writes it, with an optional "Describe this photo" field), keyboard navigation, visible focus, enough contrast in dark and light modes, 44px touch targets, screen-reader labels, and reduced-motion support.
- **Language and clarity:** clear labels, short messages, and helpful error text.

---

# STEP 7 — CLEAN-UP CHECK

Review the whole app and fix problems:
- No broken buttons, no leftover AI text, no price or shop elements.
- Every post, MyDay, chat and friend action works with two accounts.
- Private data (Outfit Planner, laundry, wear logs, stats, private items) is never visible to anyone else.
- Security rules tested: sign in as account B and try to read account A's private items, A's friends-only posts (while not a friend), and a conversation B isn't in. All must fail.
- Remove unused code and unused packages. List what was changed.

# SWOOOSH — UPDATE PROMPTS, PART 2

Paste ONE step at a time into the same AI Studio project, and test each one with two accounts before the next.

Paste this line before every step:
"Keep everything that already works. Only change what this step describes. Do not break existing pages, styling, or data."

---

# STEP 8 — REMOVE ROOMS FROM CHAT (keep simple messaging)

SWOOOSH chat should stay simple and personal, not like Discord. Remove the Rooms feature completely.

Remove:
- Rooms, "servers" and channels (for example "#ootd-of-the-day").
- Room creation, room invite links, public/invite-only rooms, the room member list, and room owner and moderator roles.
- The "Rooms" tab, buttons and menu items in the Messages page, and any room routes, components, services, Firestore collections usage and security rules.
- Any text, tutorial or label that mentions rooms, servers or channels.

Keep:
- **Direct messages between friends** with everything already built: real-time messages, emoji, photo sending, reply to a message, delete my own message, "seen" status, typing indicator, timestamps, unread badges, and online status (with the Settings option to hide it).
- Replies to a MyDay and shared posts arriving in the same chat.
- Group chats among friends (name, photo, add or remove members, leave group). Keep this as a simple group conversation, with no channels, roles or public joining.
- Block, mute, report a message or user, the message rate limit, and the spam filter.
- Only friends can DM each other.

Clean up: delete the unused room code, update the Messages page layout so it is just a conversation list and a chat window (like Messenger or Instagram DMs), and update the Firestore Security Rules so only conversation members can read or write messages.

Test: the Messages page has no rooms anywhere, direct messages and group chats still work live between two accounts, and there are no console errors.

---

# STEP 9 — NEW USER WELCOME (profile setup, then "show us your fit")

When someone creates an account for the first time, they must not land on the Home feed. They go through a short welcome flow in this order. Show a progress indicator ("Step 1 of 3") and keep the SWOOOSH look (CONCRETE colors, rounded corners, dark and light mode).

**Step 1 of 3: Set up your profile (the first thing the user sees)**
- Fields: **display name** (required), **username** (required, unique, with a live availability check and allowed characters shown), **profile picture** (upload from gallery or take a photo on phones, with a crop to a circle and in-browser compression), **bio** (optional, short, with a character counter), and **style tags** (optional: pick vibes like streetwear, minimalist, vintage, old money, casual, oversized, Y2K, sporty, techwear, colorful).
- Optional: pronouns, city or country, and birthday (used only to confirm 13+, and never shown publicly).
- Show a live preview of the profile card as they type.
- The Continue button stays disabled until the required fields are valid. Show clear, friendly error messages.
- Pre-fill the display name and photo from their Google account, and let them change both.

**Step 2 of 3: Welcome to SWOOOSH**
- A short fashion-style welcome screen: big bold text like "Welcome to SWOOOSH, {displayName}." with the line "Your wardrobe. Your style. Your people."
- A short line of what they can do: share fits, build a wardrobe, plan outfits, add friends.
- A button: "Show us your fit".

**Step 3 of 3: Show us your fit**
- Ask the user to upload a photo of one of their fits (gallery or camera). Compress it in the browser, show a preview, and let them replace it.
- Below the photo, ask them to pick a vibe for the fit (the same style tag chips, choose one or two). A "Not sure" option is allowed.
- Buttons: **Show my fit** and **Skip for now** (skipping is always allowed).

**The reaction (after the user attaches a fit)**
- Show a cool full-screen reaction with a short animation (a quick fade-and-scale, and a subtle confetti or sparkle effect that stops after a second or two). Respect reduced-motion settings, and make it readable by screen readers.
- The message uses the user's name and the vibe they picked. Pick one line at random from the matching list below, and do not repeat the same line twice in a row.
- IMPORTANT: this reaction is pre-written text. It is NOT AI. Do not call any AI service, do not claim to analyze or "see" the photo, and never mention AI. Never comment on the person's body or looks, and never write anything negative, only cool, positive hype.

Reaction lines (use {name} where shown):

- General (used when "Not sure" or no vibe was picked):
  - "{name}, that fit is tough. Welcome to SWOOOSH."
  - "Okay {name}. Your style just walked in first."
  - "That's a statement, {name}. We're keeping an eye on you."
  - "Bold move, {name}. SWOOOSH needed this."
  - "Fit check passed, {name}. Easily."
- Streetwear:
  - "Streetwear energy, loud without even trying. Respect, {name}."
  - "That's a street-ready fit, {name}. The pavement approves."
  - "{name} came in with the heat. Welcome."
- Minimalist:
  - "Clean lines, zero noise. That's confidence, {name}."
  - "Less is more, and you proved it, {name}."
  - "Quiet fit, loud taste. Nicely done, {name}."
- Vintage:
  - "Time-travel fit, {name}. Someone has thrift-store taste."
  - "That's a throwback with attitude, {name}."
  - "Old pieces, brand-new energy. Love it, {name}."
- Old money:
  - "Quiet money, loud taste, {name}."
  - "That's refined, {name}. The room just got classier."
  - "Effortless elegance, {name}. Welcome."
- Casual:
  - "Easy, effortless, exactly right, {name}."
  - "Comfortable and sharp at the same time. That's a skill, {name}."
  - "Everyday fit, main-character energy, {name}."
- Oversized:
  - "Big silhouette, bigger presence, {name}."
  - "That oversized fit is doing the talking, {name}."
  - "Roomy and ready. Nicely done, {name}."
- Y2K:
  - "Y2K called. They want their style back, but you wear it better, {name}."
  - "That's a throwback with sparkle, {name}."
- Sporty:
  - "Sporty with swagger, {name}. In the lead already."
  - "Athletic edge, street energy. Strong start, {name}."
- Techwear:
  - "Techwear mode, {name}. Built for the future."
  - "Functional and fierce. Respect, {name}."
- Colorful:
  - "Color on color on color. You make it look easy, {name}."
  - "That palette is a mood, {name}. We love it."

(Make this list easy to edit: keep it in one data file so I can add more lines later.)

**After the reaction, show three buttons:**
- **Post my first fit** (creates their first OOTD post, with the chosen vibe as a tag and a visibility picker: Public / Friends / Private. Default to Public, but let them change it before posting).
- **Save to my wardrobe** (adds the photo as a wardrobe item or fit, private by default, and asks for a name).
- **Skip, take me to Home**.

Then show a final "Find friends" suggestion card with a link to the People page, and take them to Home.

**Behavior rules**
- Show this welcome flow only once per new account. Save an `onboardingCompleted` flag in the user's profile, and save progress so the flow resumes if they close the app halfway.
- Users who already have an account with a username and display name skip the flow. Existing users without a username or display name must complete Step 1 only.
- The user cannot reach any other page until Step 1 is complete, but Steps 2 and 3 can be skipped.
- Usernames must be unique. Enforce this with a safe write (a transaction or a usernames collection) so two people can't take the same name at the same time.
- Update the Firestore Security Rules so users can only create and edit their own profile, and the username check can't be bypassed.
- Make it work well on phones: large touch targets, camera access, and a keyboard-friendly layout.

Test: sign in with a new Google account and confirm you land on Step 1, not Home. Finish the profile, see the welcome, upload a fit, pick a vibe, and see the reaction. Refresh halfway through and make sure you return to the right step. Sign out and back in and confirm the flow does not repeat.

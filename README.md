# Lockdown Line (Vercel version)

Files:
- index.html, styles.css, script.js: the page
- api/chat.js: backend function that holds your Groq key and talks to Groq
- .env.example: template for local testing only
- .gitignore: keeps .env out of git

## Deploy
1. Put this folder in a GitHub repo (the .gitignore keeps secrets out).
2. Go to vercel.com, click Add New > Project, and import the repo. Leave all build settings at their defaults.
3. Before deploying, open Environment Variables and add:
   Name:  GROQ_API_KEY
   Value: your key from https://console.groq.com/keys
4. Click Deploy. If you added the variable after deploying, redeploy once.

## Test on your computer (optional)
1. Install Node, then run: npm i -g vercel
2. Copy .env.example to .env and paste your key.
3. Run: vercel dev   (then open the address it prints)
Opening index.html directly will not work, because /api/chat needs the server.

# 🚀 AeroSense GitHub & Cloud Deployment Guide

AeroSense is ready to be pushed to your GitHub repository and deployed to the cloud so anyone in the world can access it without using `localhost`.

---

## 1. Push Code to GitHub

Follow these simple steps in your terminal or Command Prompt:

### Step A: Create a New Repository on GitHub
1. Open [https://github.com/new](https://github.com/new) in your browser.
2. Enter Repository Name: `AeroSense` (or any name you prefer).
3. Choose **Public** (or Private).
4. Leave "Add a README file" **unchecked** (we already have a complete project).
5. Click **"Create repository"**.

### Step B: Push Your Local Code
Copy and run these commands in your project terminal:

```powershell
# Rename branch to main
git branch -M main

# Link to your GitHub repository (replace YOUR_USERNAME and REPO_NAME with your GitHub url)
git remote add origin https://github.com/YOUR_USERNAME/AeroSense.git

# Push all files to GitHub
git push -u origin main
```

---

## 2. Free Cloud Hosting (No `localhost` Required!)

Once your code is on GitHub, you can deploy it for **free** on Render or Railway in under 2 minutes:

### Option A: 1-Click Free Deployment on Render (Recommended)
1. Go to [https://render.com](https://render.com) and sign up / log in with your GitHub account.
2. Click **"New +"** → Select **"Web Service"**.
3. Choose your `AeroSense` GitHub repository.
4. Settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Click **"Create Web Service"**.
6. Render will generate a live public URL (e.g. `https://aerosense.onrender.com`).
   *Anyone on earth can now open this link or scan the QR code!*

---

## 3. Instant Mobile Access via QR Code (Local Wi-Fi or Public Cloud)

1. Open AeroSense in your browser.
2. In the Left Sidebar, click **📱 Mobile App & QR Code** (or tap the phone icon).
3. A modal with a scannable QR Code and your device's network IP address (e.g. `http://192.168.x.x:3000`) will appear.
4. Open your smartphone camera (iPhone Camera or Android Google Lens / Chrome) and scan the QR code.
5. **Install on Phone:**
   - **Android:** Tap browser menu `⋮` → Tap **"Install App"** or **"Add to Home Screen"**.
   - **iPhone:** Tap the Share button `⎘` → Tap **"Add to Home Screen"** ➕.

The app will now behave just like a native mobile app on your phone with instant live data sync!

# Push to GitHub

The assistant cannot push into your personal GitHub account without an authenticated GitHub connection/token. The project is prepared for immediate push.

```bash
git init
git add .
git commit -m "AeroSense real-time atmospheric risk mapping system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/aerosense.git
git push -u origin main
```

After pushing, GitHub Actions will run all 300 test cases automatically.

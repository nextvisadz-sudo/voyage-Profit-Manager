@echo off
echo ====================================================
echo      Next Visa Travel - Push Project to GitHub
echo ====================================================
echo.
echo Make sure you have already created a blank repository on GitHub
echo at: https://github.com/new (do NOT check "Add a README" or ".gitignore").
echo.
set /p GH_USER="Enter your GitHub Username: "
set /p GH_REPO="Enter your GitHub Repository Name: "
echo.
echo Linking repository to: https://github.com/%GH_USER%/%GH_REPO%.git ...
"C:\Program Files\Git\cmd\git.exe" branch -M main
"C:\Program Files\Git\cmd\git.exe" remote remove origin 2>nul
"C:\Program Files\Git\cmd\git.exe" remote add origin https://github.com/%GH_USER%/%GH_REPO%.git
echo.
echo Pushing codebase to GitHub...
echo (A browser window or Windows popup will open asking you to authorize this upload.)
echo.
"C:\Program Files\Git\cmd\git.exe" push -u origin main
echo.
echo If the push succeeded, your codebase is now on GitHub!
echo You can now connect it to Render or Railway for public deployment.
echo.
pause

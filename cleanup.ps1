Write-Host "🔹 Cleaning project..."

# Backup SQLite file if it exists
if (Test-Path prisma\dev.db) {
    Rename-Item prisma\dev.db prisma\dev.db.backup
    Write-Host "✅ Backed up prisma/dev.db -> prisma/dev.db.backup"
}

# Remove .next build cache
if (Test-Path .next) {
    Remove-Item -Recurse -Force .next
    Write-Host "✅ Removed .next build folder"
}

# Optional: reinstall node_modules
if (Test-Path node_modules) {
    Remove-Item -Recurse -Force node_modules
    Write-Host "✅ Removed node_modules"
}
if (Test-Path package-lock.json) {
    Remove-Item package-lock.json
    Write-Host "✅ Removed package-lock.json"
}

# Regenerate Prisma client
Write-Host "🔹 Running npm install..."
npm install

Write-Host "🔹 Running prisma generate..."
npx prisma generate

Write-Host "🎉 Cleanup complete!"

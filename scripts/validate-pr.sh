#!/bin/bash

# PR Validation Script
# Usage: ./scripts/validate-pr.sh <branch-name>

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <branch-name>"
    echo "Example: $0 codex/remove-promise.all-in-removefile"
    exit 1
fi

BRANCH=$1
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "🔍 Validating PR branch: $BRANCH"
echo "📍 Current branch: $CURRENT_BRANCH"

# Fetch latest changes
echo "📡 Fetching latest changes..."
git fetch origin

# Check if branch exists
if ! git show-ref --verify --quiet refs/remotes/origin/$BRANCH; then
    echo "❌ Branch $BRANCH does not exist on remote"
    exit 1
fi

# Backup current branch
echo "💾 Backing up current state..."
BACKUP_BRANCH="backup-$(date +%s)"
git branch $BACKUP_BRANCH

# Switch to PR branch
echo "🔄 Switching to PR branch..."
git checkout $BRANCH
git pull origin $BRANCH

echo "🧹 Installing dependencies..."
if [ -f "pnpm-lock.yaml" ]; then
    if command -v pnpm >/dev/null 2>&1; then
        pnpm install
    else
        echo "⚠️  pnpm not found, using npm"
        npm install
    fi
elif [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

echo "🔍 Running validation checks..."

# Lint check
echo "📝 Running ESLint..."
if npm run lint; then
    echo "✅ Lint passed"
else
    echo "❌ Lint failed"
    VALIDATION_FAILED=true
fi

# Build check
echo "🏗️  Running build..."
if npm run build; then
    echo "✅ Build passed"
else
    echo "❌ Build failed"
    VALIDATION_FAILED=true
fi

# Test check
echo "🧪 Running tests..."
if npm run test; then
    echo "✅ Tests passed"
else
    echo "❌ Tests failed"
    VALIDATION_FAILED=true
fi

# Return to original branch
echo "🔄 Returning to original branch..."
git checkout $CURRENT_BRANCH

# Clean up backup if everything went well
if [ -z "$VALIDATION_FAILED" ]; then
    git branch -D $BACKUP_BRANCH
    echo ""
    echo "🎉 PR validation completed successfully!"
    echo "✅ Branch $BRANCH is ready to merge"
    echo ""
    echo "To merge this PR:"
    echo "1. Review the changes on GitHub"
    echo "2. If approved, merge via GitHub UI"
    echo "3. Delete the remote branch after merging"
else
    echo ""
    echo "❌ PR validation failed!"
    echo "🔧 Please fix the issues before merging"
    echo "💾 Your original state is backed up in branch: $BACKUP_BRANCH"
    exit 1
fi
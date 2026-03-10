#!/bin/bash

# Fetch updates and prune deleted remote branches
git fetch --prune

# Define the main branch
MAIN_BRANCH="main"

echo "Cleaning up local branches merged into $MAIN_BRANCH..."

# List local branches merged into main, excluding main itself and the current branch
branches_to_delete=$(git branch --merged "$MAIN_BRANCH" | grep -v "^\*" | grep -v "\b$MAIN_BRANCH\b")

if [ -n "$branches_to_delete" ]; then
    echo "Deleting the following branches:"
    echo "$branches_to_delete"
    echo "$branches_to_delete" | xargs git branch -d
    echo "Cleanup complete."
else
    echo "No merged local branches found to delete."
fi

echo "---------------------------------------------------"
echo "Current local branches:"
git branch

#!/bin/bash
git filter-branch -f --env-filter '
    export GIT_AUTHOR_NAME="akina-se"
    export GIT_AUTHOR_EMAIL="297294322+akina-se@users.noreply.github.com"
    export GIT_COMMITTER_NAME="AKINA"
    export GIT_COMMITTER_EMAIL="297294322+akina-se@users.noreply.github.com"
' -- --all

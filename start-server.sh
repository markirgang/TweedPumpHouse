#!/usr/bin/env bash
export PATH=/home/markirgang/.local/node/bin:$PATH
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Building Tweedpump production assets..."
npm run build

echo "Starting Tweedpump Local Network SCADA Server..."
node server.js

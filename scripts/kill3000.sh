#!/bin/bash

# Check if `lsof` command exists (used to find process ID)
if ! command -v lsof &> /dev/null; then
  echo "Error: 'lsof' command not found. Please install 'lsof' package."
  exit 1
fi

# Find the process ID (PID) using lsof
process_id=$(lsof -t -i tcp:3000 | awk '{print $2}')

# Check if a process was found
if [[ -z "$process_id" ]]; then
  echo "No process found listening on port 3000."
  exit 0
fi

# Terminate the process with SIGTERM (graceful termination)
echo "Terminating process with PID: $process_id"
kill -TERM "$process_id"

# Check the exit status of the kill command
if [[ $? -eq 0 ]]; then
  echo "Process terminated successfully."
else
  echo "Error: Failed to terminate process. You might need sudo privileges or try using 'kill -9 $process_id' for forceful termination."
fi

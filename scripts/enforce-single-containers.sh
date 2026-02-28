#!/usr/bin/env bash
# Check for duplicate containers for services listed in docker-compose.yml
# Usage: enforce-single-containers.sh [--fix]
#   --fix   : stop and remove older duplicate containers, keep newest

set -eu

COMPOSE_FILE="./docker-compose.yml"
FIX=0
if [ "${1-}" = "--fix" ]; then
  FIX=1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker CLI not found" >&2
  exit 2
fi

echo "Reading service container names from ${COMPOSE_FILE}"
mapfile -t CNAMES < <(awk '/container_name:/ {print $2}' "${COMPOSE_FILE}" | tr -d '"')
if [ ${#CNAMES[@]} -eq 0 ]; then
  echo "No container_name entries found in ${COMPOSE_FILE}; falling back to common service names"
  CNAMES=(rtpengine coturn kamailio phone-nginx)
fi

EXIT_CODE=0
for name in "${CNAMES[@]}"; do
  # list containers whose name contains the token
  mapfile -t LINES < <(docker ps -a --filter "name=${name}" --format '{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.CreatedAt}}')
  if [ "${#LINES[@]}" -le 1 ]; then
    continue
  fi
  echo "Found ${#LINES[@]} containers matching '${name}':"
  for l in "${LINES[@]}"; do
    echo "  $l"
  done
  if [ "$FIX" -eq 1 ]; then
    # choose newest (by CreatedAt) to keep
    keep_id=""
    keep_time=0
    for l in "${LINES[@]}"; do
      id=$(awk -F'|' '{print $1}' <<<"$l")
      started=$(docker inspect -f '{{.State.StartedAt}}' "$id" 2>/dev/null || true)
      # convert to epoch
      if [ -n "$started" ]; then
        t=$(date -d "$started" +%s 2>/dev/null || echo 0)
      else
        t=0
      fi
      if [ "$t" -ge "$keep_time" ]; then
        keep_time=$t
        keep_id=$id
      fi
    done
    echo "  Keeping container $keep_id and removing others"
    for l in "${LINES[@]}"; do
      id=$(awk -F'|' '{print $1}' <<<"$l")
      if [ "$id" != "$keep_id" ]; then
        echo "    Removing $id"
        docker rm -f "$id" || echo "      Failed to remove $id" >&2
      fi
    done
  else
    EXIT_CODE=3
  fi
done

if [ "$EXIT_CODE" -ne 0 ]; then
  echo "Duplicates detected. Rerun with --fix to remove older duplicates." >&2
fi
exit $EXIT_CODE

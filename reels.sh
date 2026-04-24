#!/usr/bin/env bash

set -uo pipefail

if ! command -v realpath >/dev/null 2>&1; then
  echo "Error: realpath is required but not installed." >&2
  exit 1
fi

SCRIPT_PATH="$(realpath "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env not found at $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required but not installed." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

VERBOSE=0
HELP_REQUESTED=0
BASE_URL_OVERRIDE=""
BASE_URL=""

TEMP_FILES=()
RESPONSE_HEADERS_FILE=""
RESPONSE_BODY_FILE=""
RESPONSE_STATUS=""
RESPONSE_CONTENT_TYPE=""

die() {
  echo "Error: $*" >&2
  exit 1
}

cleanup() {
  local file
  for file in "${TEMP_FILES[@]:-}"; do
    [[ -n "$file" && -e "$file" ]] && rm -f "$file"
  done
}

trap cleanup EXIT

make_temp() {
  local file
  file="$(mktemp)"
  TEMP_FILES+=("$file")
  printf '%s\n' "$file"
}

print_cmd() {
  local quoted=()
  local arg
  for arg in "$@"; do
    quoted+=("$(printf '%q' "$arg")")
  done
  printf 'curl call: %s\n' "${quoted[*]}" >&2
}

show_help() {
  cat <<EOF
Usage: ./reels.sh [GLOBAL_OPTIONS] COMMAND [COMMAND_OPTIONS]

Global options:
  -h, --help              Show this help
  -v, --verbose           Show full curl calls and full JSON responses
  --base-url URL          Override API base URL from .env

Configuration:
  .env is required and is always loaded from:
    $ENV_FILE

  The script does not assume an API host. Set API_BASE_URL in .env
  or pass --base-url.

Core commands:
  upload FILE
  download-video URL
  analyze VIDEO_ID [--prompt-id ID]
  detect-scenes VIDEO_ID [SCENE_OPTIONS]
  describe-video VIDEO_ID [SCENE_OPTIONS]
  prompts
  results VIDEO_ID
  scenes-json VIDEO_ID
  scenes-html VIDEO_ID [--output FILE]
  reprocess VIDEO_ID
  progress VIDEO_ID

Scene analysis options:
  --threshold N              Hard-cut threshold (0.0-1.0]
  --split-mode MODE          cut | motion | hybrid
                            Hybrid defaults: motion-threshold 0.12, min-scene-duration 1.0
  --motion-threshold N       Sensitivity for motion-aware splitting
  --min-scene-duration SEC   Merge boundaries closer than this duration
  --fps N, --frame-fps N     Sample at least N frames per second within each scene
  --extract-frames           Extract representative frames
  --describe-scenes          Generate descriptions for each scene
  --transcribe-audio         Transcribe scene audio when available
  --language NAME            Force output language

Article commands:
  fetch-news [--query TEXT]
  fetch-url URL
  articles
  article ARTICLE_ID
  dashboard
  batch-add [--count N]
  article-describe ARTICLE_ID [--threshold N]
  article-rate ARTICLE_ID
  article-delete ARTICLE_ID [--yes]
  articles-delete-all [--yes]

FPO and status commands:
  fpo-run [--iterations N] [--evolution-interval N] [--no-evolution]
  fpo-status
  flags-status
  queue-status

Generic fallback:
  request METHOD PATH [--json STRING | --json-file FILE] [--content-type TYPE] [--output FILE]

Examples:
  ./reels.sh upload ./clip.mp4
  ./reels.sh detect-scenes <VIDEO_ID> --extract-frames --describe-scenes --transcribe-audio --language English
  ./reels.sh describe-video <VIDEO_ID> --split-mode hybrid --motion-threshold 0.12 --fps 4 --language English
  ./reels.sh -v fetch-news --query "technology news video"
  ./reels.sh article-describe <ARTICLE_ID> --threshold 0.3
  ./reels.sh request GET /api/thumbnails/<ARTICLE_ID>.mp4 --output article-thumb.mp4
EOF
}

json_bool() {
  if [[ "$1" == "1" ]]; then
    printf 'true'
  else
    printf 'false'
  fi
}

resolve_base_url() {
  local value=""

  if [[ -n "$BASE_URL_OVERRIDE" ]]; then
    value="$BASE_URL_OVERRIDE"
  elif [[ -n "${API_BASE_URL:-}" ]]; then
    value="$API_BASE_URL"
  elif [[ -n "${REELS_API_BASE_URL:-}" ]]; then
    value="$REELS_API_BASE_URL"
  fi

  [[ -n "$value" ]] || die "API base URL is not set. Add API_BASE_URL to $ENV_FILE or pass --base-url."
  printf '%s\n' "${value%/}"
}

require_base_url() {
  if [[ -z "$BASE_URL" ]]; then
    BASE_URL="$(resolve_base_url)"
  fi
}

build_url() {
  local path="$1"

  if [[ "$path" =~ ^https?:// ]]; then
    printf '%s\n' "$path"
    return 0
  fi

  require_base_url
  if [[ "$path" != /* ]]; then
    path="/$path"
  fi
  printf '%s%s\n' "$BASE_URL" "$path"
}

is_json_content_type() {
  local content_type="${1,,}"
  [[ "$content_type" == application/json* || "$content_type" == *+json* || "$content_type" == */json* ]]
}

run_capture() {
  local headers_file body_file
  headers_file="$(make_temp)"
  body_file="$(make_temp)"

  local -a cmd=(curl -sS -L -D "$headers_file" -o "$body_file" "$@")

  if (( VERBOSE )); then
    print_cmd "${cmd[@]}"
  fi

  if ! "${cmd[@]}"; then
    local exit_code=$?
    echo "Error: curl failed with exit code $exit_code" >&2
    if [[ -s "$body_file" ]]; then
      cat "$body_file" >&2
    fi
    exit "$exit_code"
  fi

  RESPONSE_HEADERS_FILE="$headers_file"
  RESPONSE_BODY_FILE="$body_file"
  RESPONSE_STATUS="$(awk '/^HTTP\/[0-9.]+ /{status=$2} END{print status}' "$headers_file")"
  RESPONSE_CONTENT_TYPE="$(awk -F': *' 'tolower($1)=="content-type"{value=$2} END{gsub(/\r/, "", value); print value}' "$headers_file")"
}

emit_body() {
  local mode="$1"
  local output_file="${2:-}"

  if [[ -n "$output_file" ]]; then
    cp "$RESPONSE_BODY_FILE" "$output_file"
    printf '%s\n' "$output_file"
    return 0
  fi

  case "$mode" in
    raw)
      cat "$RESPONSE_BODY_FILE"
      ;;
    json)
      jq . "$RESPONSE_BODY_FILE" 2>/dev/null || cat "$RESPONSE_BODY_FILE"
      ;;
    auto)
      if is_json_content_type "$RESPONSE_CONTENT_TYPE" || jq -e . "$RESPONSE_BODY_FILE" >/dev/null 2>&1; then
        jq . "$RESPONSE_BODY_FILE" 2>/dev/null || cat "$RESPONSE_BODY_FILE"
      else
        cat "$RESPONSE_BODY_FILE"
      fi
      ;;
    *)
      die "Unsupported emit mode: $mode"
      ;;
  esac
}

ensure_success() {
  local label="$1"

  [[ "$RESPONSE_STATUS" =~ ^[0-9]+$ ]] || die "$label failed: missing HTTP status"

  if (( VERBOSE )); then
    printf 'http status: %s\n' "$RESPONSE_STATUS" >&2
    if [[ -n "$RESPONSE_CONTENT_TYPE" ]]; then
      printf 'content-type: %s\n' "$RESPONSE_CONTENT_TYPE" >&2
    fi
  fi

  if (( RESPONSE_STATUS < 200 || RESPONSE_STATUS >= 300 )); then
    echo "Error: $label failed with HTTP $RESPONSE_STATUS" >&2
    if [[ -s "$RESPONSE_BODY_FILE" ]]; then
      emit_body auto >&2
    fi
    exit 1
  fi
}

json_request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local label="$4"

  local url
  url="$(build_url "$path")"

  local -a curl_args=(-X "$method" "$url" -H "Accept: application/json")
  if [[ -n "$body" ]]; then
    curl_args+=(-H "Content-Type: application/json" --data "$body")
  fi

  run_capture "${curl_args[@]}"
  ensure_success "$label"
  emit_body json
}

multipart_request() {
  local method="$1"
  local path="$2"
  local label="$3"
  shift 3

  local url
  url="$(build_url "$path")"

  local -a curl_args=(-X "$method" "$url" -H "Accept: application/json" "$@")

  run_capture "${curl_args[@]}"
  ensure_success "$label"
  emit_body json
}

raw_request() {
  local method="$1"
  local path="$2"
  local label="$3"
  local output_file="${4:-}"

  local url
  url="$(build_url "$path")"

  local -a curl_args=(-X "$method" "$url")

  run_capture "${curl_args[@]}"
  ensure_success "$label"
  emit_body auto "$output_file"
}

confirm_or_die() {
  local prompt="$1"
  local response=""
  printf '%s [y/N]: ' "$prompt" >&2
  read -r response
  [[ "$response" == "y" || "$response" == "Y" || "$response" == "yes" || "$response" == "YES" ]] || die "Cancelled."
}

cmd_upload() {
  local file=""
  while (($#)); do
    case "$1" in
      --file)
        [[ $# -ge 2 ]] || die "--file requires a path"
        file="$2"
        shift 2
        ;;
      -*)
        die "Unknown option for upload: $1"
        ;;
      *)
        [[ -z "$file" ]] || die "upload accepts only one file"
        file="$1"
        shift
        ;;
    esac
  done

  [[ -n "$file" ]] || die "upload requires a file path"
  [[ -f "$file" ]] || die "File not found: $file"

  multipart_request POST /api/upload "upload" -F "video=@$file"
}

cmd_download_video() {
  local url=""
  while (($#)); do
    case "$1" in
      --url)
        [[ $# -ge 2 ]] || die "--url requires a value"
        url="$2"
        shift 2
        ;;
      -*)
        die "Unknown option for download-video: $1"
        ;;
      *)
        [[ -z "$url" ]] || die "download-video accepts only one URL"
        url="$1"
        shift
        ;;
    esac
  done

  [[ -n "$url" ]] || die "download-video requires a URL"

  local body
  body="$(jq -n --arg url "$url" '{url: $url}')"
  json_request POST /api/download-video "$body" "download-video"
}

cmd_analyze() {
  local video_id=""
  local prompt_id=""

  while (($#)); do
    case "$1" in
      --prompt-id)
        [[ $# -ge 2 ]] || die "--prompt-id requires a value"
        prompt_id="$2"
        shift 2
        ;;
      -*)
        die "Unknown option for analyze: $1"
        ;;
      *)
        [[ -z "$video_id" ]] || die "analyze accepts only one VIDEO_ID"
        video_id="$1"
        shift
        ;;
    esac
  done

  [[ -n "$video_id" ]] || die "analyze requires VIDEO_ID"

  local prompt_present="0"
  [[ -n "$prompt_id" ]] && prompt_present="1"

  local body
  body="$(jq -n \
    --arg videoId "$video_id" \
    --arg promptId "$prompt_id" \
    --argjson hasPrompt "$(json_bool "$prompt_present")" \
    '
      {videoId: $videoId}
      + (if $hasPrompt then {promptId: $promptId} else {} end)
    '
  )"

  json_request POST /api/analyze "$body" "analyze"
}

cmd_detect_scenes_common() {
  local command_name="$1"
  local force_describe="$2"
  shift 2

  local video_id=""
  local threshold=""
  local split_mode=""
  local motion_threshold=""
  local min_scene_duration=""
  local frame_fps=""
  local language=""
  local extract_frames=0
  local describe_scenes=0
  local transcribe_audio=0

  if [[ "$force_describe" == "1" ]]; then
    extract_frames=1
    describe_scenes=1
  fi

  while (($#)); do
    case "$1" in
      --threshold)
        [[ $# -ge 2 ]] || die "--threshold requires a numeric value"
        threshold="$2"
        shift 2
        ;;
      --split-mode)
        [[ $# -ge 2 ]] || die "--split-mode requires a value"
        split_mode="$2"
        shift 2
        ;;
      --motion-threshold)
        [[ $# -ge 2 ]] || die "--motion-threshold requires a numeric value"
        motion_threshold="$2"
        shift 2
        ;;
      --min-scene-duration)
        [[ $# -ge 2 ]] || die "--min-scene-duration requires a numeric value"
        min_scene_duration="$2"
        shift 2
        ;;
      --fps|--frame-fps)
        [[ $# -ge 2 ]] || die "$1 requires a numeric value"
        frame_fps="$2"
        shift 2
        ;;
      --extract-frames)
        extract_frames=1
        shift
        ;;
      --describe-scenes)
        describe_scenes=1
        shift
        ;;
      --transcribe-audio)
        transcribe_audio=1
        shift
        ;;
      --language)
        [[ $# -ge 2 ]] || die "--language requires a value"
        language="$2"
        shift 2
        ;;
      -*)
        die "Unknown option for $command_name: $1"
        ;;
      *)
        [[ -z "$video_id" ]] || die "$command_name accepts only one VIDEO_ID"
        video_id="$1"
        shift
        ;;
    esac
  done

  [[ -n "$video_id" ]] || die "$command_name requires VIDEO_ID"

  if (( describe_scenes )); then
    extract_frames=1
  fi

  local has_threshold=0
  local has_split_mode=0
  local has_motion_threshold=0
  local has_min_scene_duration=0
  local has_frame_fps=0
  local has_language=0
  [[ -n "$threshold" ]] && has_threshold=1
  [[ -n "$split_mode" ]] && has_split_mode=1
  [[ -n "$motion_threshold" ]] && has_motion_threshold=1
  [[ -n "$min_scene_duration" ]] && has_min_scene_duration=1
  [[ -n "$frame_fps" ]] && has_frame_fps=1
  [[ -n "$language" ]] && has_language=1

  local body
  body="$(jq -n \
    --arg videoId "$video_id" \
    --arg threshold "$threshold" \
    --arg splitMode "$split_mode" \
    --arg motionThreshold "$motion_threshold" \
    --arg minSceneDuration "$min_scene_duration" \
    --arg frameFps "$frame_fps" \
    --arg language "$language" \
    --argjson hasThreshold "$(json_bool "$has_threshold")" \
    --argjson hasSplitMode "$(json_bool "$has_split_mode")" \
    --argjson hasMotionThreshold "$(json_bool "$has_motion_threshold")" \
    --argjson hasMinSceneDuration "$(json_bool "$has_min_scene_duration")" \
    --argjson hasFrameFps "$(json_bool "$has_frame_fps")" \
    --argjson hasLanguage "$(json_bool "$has_language")" \
    --argjson extractFrames "$(json_bool "$extract_frames")" \
    --argjson describeScenes "$(json_bool "$describe_scenes")" \
    --argjson transcribeAudio "$(json_bool "$transcribe_audio")" \
    '
      {videoId: $videoId}
      + (if $hasThreshold then {threshold: ($threshold | tonumber)} else {} end)
      + (if $hasSplitMode then {splitMode: $splitMode} else {} end)
      + (if $hasMotionThreshold then {motionThreshold: ($motionThreshold | tonumber)} else {} end)
      + (if $hasMinSceneDuration then {minSceneDuration: ($minSceneDuration | tonumber)} else {} end)
      + (if $hasFrameFps then {frameFps: ($frameFps | tonumber)} else {} end)
      + (if $extractFrames then {extractFrames: true} else {} end)
      + (if $describeScenes then {describeScenes: true} else {} end)
      + (if $transcribeAudio then {transcribeAudio: true} else {} end)
      + (if $hasLanguage then {language: $language} else {} end)
    '
  )"

  json_request POST /api/detect-scenes "$body" "$command_name"
}

cmd_detect_scenes() {
  cmd_detect_scenes_common "detect-scenes" 0 "$@"
}

cmd_describe_video() {
  cmd_detect_scenes_common "describe-video" 1 "$@"
}

cmd_prompts() {
  json_request GET /api/prompts "" "prompts"
}

cmd_results() {
  [[ $# -eq 1 ]] || die "results requires VIDEO_ID"
  json_request GET "/api/results/$1" "" "results"
}

cmd_fpo_run() {
  local iterations=""
  local evolution_interval=""
  local evolution_set=0
  local evolution_enabled=1

  while (($#)); do
    case "$1" in
      --iterations)
        [[ $# -ge 2 ]] || die "--iterations requires a numeric value"
        iterations="$2"
        shift 2
        ;;
      --evolution-interval)
        [[ $# -ge 2 ]] || die "--evolution-interval requires a numeric value"
        evolution_interval="$2"
        shift 2
        ;;
      --no-evolution)
        evolution_set=1
        evolution_enabled=0
        shift
        ;;
      --enable-evolution)
        evolution_set=1
        evolution_enabled=1
        shift
        ;;
      -*)
        die "Unknown option for fpo-run: $1"
        ;;
      *)
        die "Unexpected argument for fpo-run: $1"
        ;;
    esac
  done

  local has_iterations=0
  local has_interval=0
  [[ -n "$iterations" ]] && has_iterations=1
  [[ -n "$evolution_interval" ]] && has_interval=1

  local body
  body="$(jq -n \
    --arg iterations "$iterations" \
    --arg evolutionInterval "$evolution_interval" \
    --argjson hasIterations "$(json_bool "$has_iterations")" \
    --argjson hasInterval "$(json_bool "$has_interval")" \
    --argjson hasEvolution "$(json_bool "$evolution_set")" \
    --argjson enableEvolution "$(json_bool "$evolution_enabled")" \
    '
      {}
      + (if $hasIterations then {iterations: ($iterations | tonumber)} else {} end)
      + (if $hasEvolution then {enableEvolution: $enableEvolution} else {} end)
      + (if $hasInterval then {evolutionInterval: ($evolutionInterval | tonumber)} else {} end)
    '
  )"

  json_request POST /api/fpo/run "$body" "fpo-run"
}

cmd_fpo_status() {
  json_request GET /api/fpo/status "" "fpo-status"
}

cmd_scenes_json() {
  [[ $# -eq 1 ]] || die "scenes-json requires VIDEO_ID"
  json_request GET "/api/scenes/$1/json" "" "scenes-json"
}

cmd_scenes_html() {
  local video_id=""
  local output_file=""

  while (($#)); do
    case "$1" in
      --output)
        [[ $# -ge 2 ]] || die "--output requires a path"
        output_file="$2"
        shift 2
        ;;
      -*)
        die "Unknown option for scenes-html: $1"
        ;;
      *)
        [[ -z "$video_id" ]] || die "scenes-html accepts only one VIDEO_ID"
        video_id="$1"
        shift
        ;;
    esac
  done

  [[ -n "$video_id" ]] || die "scenes-html requires VIDEO_ID"
  raw_request GET "/api/scenes/$video_id" "scenes-html" "$output_file"
}

cmd_fetch_news() {
  local query=""

  while (($#)); do
    case "$1" in
      --query)
        [[ $# -ge 2 ]] || die "--query requires a value"
        query="$2"
        shift 2
        ;;
      -*)
        die "Unknown option for fetch-news: $1"
        ;;
      *)
        die "Unexpected argument for fetch-news: $1"
        ;;
    esac
  done

  local has_query=0
  [[ -n "$query" ]] && has_query=1

  local body
  body="$(jq -n \
    --arg query "$query" \
    --argjson hasQuery "$(json_bool "$has_query")" \
    '
      {}
      + (if $hasQuery then {query: $query} else {} end)
    '
  )"

  json_request POST /api/fetch-news "$body" "fetch-news"
}

cmd_fetch_url() {
  local url=""
  while (($#)); do
    case "$1" in
      --url)
        [[ $# -ge 2 ]] || die "--url requires a value"
        url="$2"
        shift 2
        ;;
      -*)
        die "Unknown option for fetch-url: $1"
        ;;
      *)
        [[ -z "$url" ]] || die "fetch-url accepts only one URL"
        url="$1"
        shift
        ;;
    esac
  done

  [[ -n "$url" ]] || die "fetch-url requires a URL"

  local body
  body="$(jq -n --arg url "$url" '{url: $url}')"
  json_request POST /api/fetch-from-url "$body" "fetch-url"
}

cmd_articles() {
  json_request GET /api/articles "" "articles"
}

cmd_article() {
  [[ $# -eq 1 ]] || die "article requires ARTICLE_ID"
  json_request GET "/api/articles/$1" "" "article"
}

cmd_dashboard() {
  json_request GET /api/dashboard "" "dashboard"
}

cmd_batch_add() {
  local count=""

  while (($#)); do
    case "$1" in
      --count)
        [[ $# -ge 2 ]] || die "--count requires a numeric value"
        count="$2"
        shift 2
        ;;
      -*)
        die "Unknown option for batch-add: $1"
        ;;
      *)
        if [[ -z "$count" ]]; then
          count="$1"
          shift
        else
          die "Unexpected argument for batch-add: $1"
        fi
        ;;
    esac
  done

  local has_count=0
  [[ -n "$count" ]] && has_count=1

  local body
  body="$(jq -n \
    --arg count "$count" \
    --argjson hasCount "$(json_bool "$has_count")" \
    '
      {}
      + (if $hasCount then {count: ($count | tonumber)} else {} end)
    '
  )"

  json_request POST /api/articles/batch-add "$body" "batch-add"
}

cmd_article_describe() {
  local article_id=""
  local threshold=""

  while (($#)); do
    case "$1" in
      --threshold)
        [[ $# -ge 2 ]] || die "--threshold requires a numeric value"
        threshold="$2"
        shift 2
        ;;
      -*)
        die "Unknown option for article-describe: $1"
        ;;
      *)
        [[ -z "$article_id" ]] || die "article-describe accepts only one ARTICLE_ID"
        article_id="$1"
        shift
        ;;
    esac
  done

  [[ -n "$article_id" ]] || die "article-describe requires ARTICLE_ID"

  local has_threshold=0
  [[ -n "$threshold" ]] && has_threshold=1

  local body
  body="$(jq -n \
    --arg threshold "$threshold" \
    --argjson hasThreshold "$(json_bool "$has_threshold")" \
    '
      {}
      + (if $hasThreshold then {threshold: ($threshold | tonumber)} else {} end)
    '
  )"

  json_request POST "/api/articles/$article_id/describe" "$body" "article-describe"
}

cmd_article_rate() {
  [[ $# -eq 1 ]] || die "article-rate requires ARTICLE_ID"
  json_request POST "/api/articles/$1/rate" '{}' "article-rate"
}

cmd_article_delete() {
  local article_id=""
  local confirmed=0

  while (($#)); do
    case "$1" in
      --yes)
        confirmed=1
        shift
        ;;
      -*)
        die "Unknown option for article-delete: $1"
        ;;
      *)
        [[ -z "$article_id" ]] || die "article-delete accepts only one ARTICLE_ID"
        article_id="$1"
        shift
        ;;
    esac
  done

  [[ -n "$article_id" ]] || die "article-delete requires ARTICLE_ID"
  if (( ! confirmed )); then
    confirm_or_die "Delete article $article_id and its associated files?"
  fi

  json_request DELETE "/api/articles/$article_id" "" "article-delete"
}

cmd_articles_delete_all() {
  local confirmed=0

  while (($#)); do
    case "$1" in
      --yes)
        confirmed=1
        shift
        ;;
      -*)
        die "Unknown option for articles-delete-all: $1"
        ;;
      *)
        die "articles-delete-all does not accept positional arguments"
        ;;
    esac
  done

  if (( ! confirmed )); then
    confirm_or_die "Delete all articles and all associated files?"
  fi

  json_request DELETE /api/articles "" "articles-delete-all"
}

cmd_flags_status() {
  json_request GET /api/flags/status "" "flags-status"
}

cmd_queue_status() {
  json_request GET /api/queue/status "" "queue-status"
}

cmd_reprocess() {
  [[ $# -eq 1 ]] || die "reprocess requires VIDEO_ID"
  local body
  body="$(jq -n --arg videoId "$1" '{videoId: $videoId}')"
  json_request POST /api/reprocess "$body" "reprocess"
}

cmd_progress() {
  [[ $# -eq 1 ]] || die "progress requires VIDEO_ID"

  local url
  url="$(build_url "/api/progress/$1")"
  local -a cmd=(curl -sS -N -H "Accept: text/event-stream" "$url")

  if (( VERBOSE )); then
    print_cmd "${cmd[@]}"
  fi

  "${cmd[@]}"
}

cmd_request() {
  local method=""
  local path=""
  local json_inline=""
  local json_file=""
  local output_file=""
  local content_type="application/json"

  while (($#)); do
    case "$1" in
      --json)
        [[ $# -ge 2 ]] || die "--json requires a string value"
        json_inline="$2"
        shift 2
        ;;
      --json-file)
        [[ $# -ge 2 ]] || die "--json-file requires a path"
        json_file="$2"
        shift 2
        ;;
      --output)
        [[ $# -ge 2 ]] || die "--output requires a path"
        output_file="$2"
        shift 2
        ;;
      --content-type)
        [[ $# -ge 2 ]] || die "--content-type requires a value"
        content_type="$2"
        shift 2
        ;;
      -*)
        die "Unknown option for request: $1"
        ;;
      *)
        if [[ -z "$method" ]]; then
          method="$1"
        elif [[ -z "$path" ]]; then
          path="$1"
        else
          die "Unexpected argument for request: $1"
        fi
        shift
        ;;
    esac
  done

  [[ -n "$method" ]] || die "request requires METHOD"
  [[ -n "$path" ]] || die "request requires PATH"
  [[ -z "$json_inline" || -z "$json_file" ]] || die "Use either --json or --json-file, not both"

  local body=""
  if [[ -n "$json_file" ]]; then
    [[ -f "$json_file" ]] || die "JSON file not found: $json_file"
    body="$(cat "$json_file")"
  elif [[ -n "$json_inline" ]]; then
    body="$json_inline"
  fi

  local url
  url="$(build_url "$path")"

  local -a curl_args=(-X "$method" "$url")
  if [[ -n "$body" ]]; then
    curl_args+=(-H "Content-Type: $content_type" --data "$body")
  fi

  run_capture "${curl_args[@]}"
  ensure_success "request"
  emit_body auto "$output_file"
}

FILTERED_ARGS=()
ORIGINAL_ARGS=("$@")
index=0

while (( index < ${#ORIGINAL_ARGS[@]} )); do
  arg="${ORIGINAL_ARGS[$index]}"
  case "$arg" in
    -h|--help)
      HELP_REQUESTED=1
      ;;
    -v|--verbose)
      VERBOSE=1
      ;;
    --base-url)
      (( index + 1 < ${#ORIGINAL_ARGS[@]} )) || die "--base-url requires a value"
      BASE_URL_OVERRIDE="${ORIGINAL_ARGS[$((index + 1))]}"
      ((index++))
      ;;
    *)
      FILTERED_ARGS+=("$arg")
      ;;
  esac
  ((index++))
done

set -- "${FILTERED_ARGS[@]}"

if (( HELP_REQUESTED )) || [[ $# -eq 0 ]]; then
  show_help
  exit 0
fi

COMMAND="$1"
shift

case "$COMMAND" in
  upload)
    cmd_upload "$@"
    ;;
  download-video)
    cmd_download_video "$@"
    ;;
  analyze)
    cmd_analyze "$@"
    ;;
  detect-scenes)
    cmd_detect_scenes "$@"
    ;;
  describe-video)
    cmd_describe_video "$@"
    ;;
  prompts)
    cmd_prompts "$@"
    ;;
  results)
    cmd_results "$@"
    ;;
  fpo-run)
    cmd_fpo_run "$@"
    ;;
  fpo-status)
    cmd_fpo_status "$@"
    ;;
  scenes-json)
    cmd_scenes_json "$@"
    ;;
  scenes-html)
    cmd_scenes_html "$@"
    ;;
  fetch-news)
    cmd_fetch_news "$@"
    ;;
  fetch-url)
    cmd_fetch_url "$@"
    ;;
  articles)
    cmd_articles "$@"
    ;;
  article)
    cmd_article "$@"
    ;;
  dashboard)
    cmd_dashboard "$@"
    ;;
  batch-add)
    cmd_batch_add "$@"
    ;;
  article-describe)
    cmd_article_describe "$@"
    ;;
  article-rate)
    cmd_article_rate "$@"
    ;;
  article-delete)
    cmd_article_delete "$@"
    ;;
  articles-delete-all)
    cmd_articles_delete_all "$@"
    ;;
  flags-status)
    cmd_flags_status "$@"
    ;;
  queue-status)
    cmd_queue_status "$@"
    ;;
  reprocess)
    cmd_reprocess "$@"
    ;;
  progress)
    cmd_progress "$@"
    ;;
  request)
    cmd_request "$@"
    ;;
  help)
    show_help
    ;;
  *)
    die "Unknown command: $COMMAND"
    ;;
esac

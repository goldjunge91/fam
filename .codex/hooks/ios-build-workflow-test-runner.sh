#!/usr/bin/env bash

set -euo pipefail

printf '%s' "${1:?mode}" > "${IOS_BUILD_WORKFLOW_TEST_LOG:?log path}"

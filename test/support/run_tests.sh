#!/bin/sh

# Must match redis_opts.js
REDIS_PORT=$(grep -w port $(dirname $0)/redis_opts.js | sed 's/.*: *//')

cleanup() {
	echo "Cleaning up"
	kill ${PID_REDIS}
}

cleanup_and_exit() {
	cleanup
	exit
}

die() {
	msg=$1
	echo "${msg}" >&2
	cleanup
	exit 1
}

trap 'cleanup_and_exit' 1 2 3 5 9 13

echo "Starting redis on port ${REDIS_PORT}"
echo "port ${REDIS_PORT}" | redis-server - > test.log &
PID_REDIS=$!

echo "Running tests"
mocha -u tdd -t 3000
ret=$?

cleanup

exit $ret

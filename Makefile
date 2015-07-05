all:
	npm install

clean:
	rm -rf node_modules/*

TEST_SUITE := $(shell find ./test -name "*.js")

test:
	./node_modules/.bin/mocha -u tdd -t 5000 $(TEST_SUITE) ${MOCHA_ARGS}

.PHONY: test

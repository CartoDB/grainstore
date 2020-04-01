all:
	npm ci

clean:
	rm -rf node_modules/*
	
eslint:
	@./node_modules/.bin/eslint lib/ test/

TEST_SUITE := $(shell find ./test -name "*.js")

test: eslint
	NODE_ENV=test ./node_modules/.bin/mocha --exit -R dot -u tdd -t 5000 $(TEST_SUITE) ${MOCHA_ARGS}

.PHONY: test eslint

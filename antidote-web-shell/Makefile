.PHONY: all run start-server start-docker stop-docker build clean

DOCKER_COMPOSE=docker compose

all: build

build:
	npm install

run: start-docker start-server 

start-server:
	npm start

start-server-testenv:
	PORT=3000 NODE_ENV=production npm start > webshell.log 2>&1

start-docker:
	${DOCKER_COMPOSE} -f docker/docker-antidote.yml up -d

stop-docker:
	${DOCKER_COMPOSE} -f docker/docker-antidote.yml down

clean: stop-docker
	npm run clean

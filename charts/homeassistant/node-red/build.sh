#!/bin/bash

cd "$(dirname "$(readlink -f "$0")")"

docker build -t justin8/node-red .
docker push justin8/node-red # We need to push, as kubernetes will try to ensure the version we have matches the repository
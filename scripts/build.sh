#!/bin/sh

set -e

npm test

mkdir -p dist

rm -rf dist/*
cp .tmp/dist/* dist

#!/bin/sh

npm test

mkdir -p dist

rm -rf dist/*
cp .tmp/dist/* dist

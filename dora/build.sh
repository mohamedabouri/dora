#!/bin/bash
# 1. build React
cd frontend
npm ci
npm run build
cd ..

pip install -r requirements.txt
python manage.py collectstatic --noinput
#!/bin/bash
python manage.py migrate --noinput
gunicorn dora.wsgi:application --bind 0.0.0.0:$PORT
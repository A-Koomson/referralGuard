# Optional convenience targets — never the only documented commands.
.PHONY: migrate seed backend frontend test-backend test-frontend eval-mock

migrate:
	python backend/manage.py migrate

seed:
	python backend/manage.py bootstrap_demo

backend:
	python backend/manage.py runserver 127.0.0.1:8000

frontend:
	cd frontend && npm run dev

test-backend:
	python -m pytest backend

test-frontend:
	cd frontend && npm test

eval-mock:
	python backend/manage.py run_baseline --mode mock
	python backend/manage.py evaluate_referrals --mode mock

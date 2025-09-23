#!/usr/bin/env bash
# GCP_PROJECT_NAME={GCP_PROJECT_NAME}
# APP_VERSION=1.8
AR_PROJECT_NAME=nodejs-dev-template
PROJECT_NAME=nodejs-dev-fn-template
CLOUDRUN_SERVICE=nodejs-dev-template-service

gcloud config set project $GCP_PROJECT_NAME
gcloud auth configure-docker $AR_TARGET
gcloud auth configure-docker --quiet
gcloud artifacts repositories create $AR_PROJECT_NAME --repository-format=docker --location=asia --description="Docker repository"
docker build -t asia-docker.pkg.dev/$GCP_PROJECT_NAME/$AR_PROJECT_NAME/$PROJECT_NAME:$APP_VERSION .
docker push asia-docker.pkg.dev/$GCP_PROJECT_NAME/$AR_PROJECT_NAME/$PROJECT_NAME:$APP_VERSION
gcloud run deploy $CLOUDRUN_SERVICE \
    --image=asia-docker.pkg.dev/$GCP_PROJECT_NAME/$AR_PROJECT_NAME/$PROJECT_NAME:$APP_VERSION \
    --region=asia-east1 \
    --platform=managed \
    --allow-unauthenticated \
    --memory=512Mi \
    --cpu=1 \
    --max-instances=3 \
    --timeout=10m \
    --concurrency=1 \


# gcloud run services delete $CLOUDRUN_SERVICE --platform=managed --region=asia-east1
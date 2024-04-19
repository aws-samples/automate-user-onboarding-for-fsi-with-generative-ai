#!/bin/bash

# Get default region
AWS_REGION=$(aws configure get region)

# Get account ID
AWS_ACCOUNT=$(aws sts get-caller-identity --query 'Account' --output text)

IMAGE='penny-workshop'

aws ecr create-repository --repository-name ${IMAGE}

# Get login for ECR 
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker image
docker build --no-cache -t $IMAGE:latest . 

# Create a timestamp tag
TAG=$(date +%Y%m%d_%H%M%S)

# Tag the image
docker tag $IMAGE:latest $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$IMAGE:$TAG

# Push image 
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$IMAGE:$TAG

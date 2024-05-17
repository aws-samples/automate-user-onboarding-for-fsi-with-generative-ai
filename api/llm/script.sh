#!/bin/bash

AWS_REGION=$(aws configure get region)

AWS_ACCOUNT=$(aws sts get-caller-identity --query 'Account' --output text)

IMAGE='penny-workshop'

aws ecr create-repository --repository-name ${IMAGE}

aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com

docker build --no-cache -t $IMAGE:latest . 

TAG=$(date +%Y%m%d_%H%M%S)

docker tag $IMAGE:latest $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$IMAGE:$TAG

docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$IMAGE:$TAG

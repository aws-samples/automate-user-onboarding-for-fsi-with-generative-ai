import boto3
import json
import os

def main(event, context):
    statusCode = 200 
    isBase64Encoded = True
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers" : "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET"
    }

    try:
        dynamodb_client = boto3.client('dynamodb')

        get_response = dynamodb_client.get_item(
            TableName=os.environ['tableName'],
            Key = {
                'email': {'S': event["email"]},
            }
        )

        if "Item" in get_response:
            body = "Account with given email already exists"
        else:
            body = "Account with given email does not exist. Proceed with account opening."
    
    except Exception as e:
        statusCode = 500
        body += str(e)

    finally:
        response = {
            "isBase64Encoded": isBase64Encoded,
            "statusCode": statusCode,
            "body": body,
            "headers": headers
        }
        return response

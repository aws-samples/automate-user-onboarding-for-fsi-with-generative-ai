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
        "Access-Control-Allow-Methods": "POST"
    }

    try:
        dynamodb_client = boto3.client('dynamodb')

        email = event['email']
        account_type = event['account_type']
        first_name = event['first_name']
        last_name = event['last_name']
        id_file_name = event['id_file_name']
        selfie_file_name = event['selfie_file_name']
        
        put_response = dynamodb_client.put_item(
            TableName=os.environ['tableName'],
            Item = {
                'email': {'S': email},
                'account_type': {'S': account_type},
                'first_name': {'S': first_name},
                'last_name': {'S': last_name},
                'id_file_name': {'S': id_file_name},
                'selfie_file_name': {'S': selfie_file_name},
            }
        )
        
        body = "New account created successfully."
        
        ses_client = boto3.client('ses')
        ses_client.send_email(
            Source=os.environ['sesIdentityEmail'],
            Destination={
                'ToAddresses': [email]
            },
            Message={
                'Subject': {'Data': 'Welcome to AnyBank!'},
                'Body': {'Text': {'Data': 'Hello ' + first_name + ' ' + last_name + ', thank you for creating a new ' + account_type + ' account with AnyBank. We have completed your ID and face verification successfully and you should be ready to access your account!'}}
            }
        )
        
        body += " User notified via email"

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

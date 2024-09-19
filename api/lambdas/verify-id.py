import boto3
import json
import os

def extract_text(id_file_name):
    textract_client = boto3.client('textract')

    response = textract_client.analyze_id(
        DocumentPages = [
            {
                'S3Object': {
                    'Bucket': os.environ['bucketName'],
                    'Name': id_file_name,
                }
            }
        ],
    )
    
    id_field_values = {}
    
    for doc_fields in response['IdentityDocuments']:
        for id_field in doc_fields['IdentityDocumentFields']:
            curr_type = ""
            curr_val = ""
            for key, val in id_field.items():
                if "Type" in str(key):
                    curr_type = str(val['Text'])
            for key, val in id_field.items():
                if "ValueDetection" in str(key):
                    curr_val = str(val['Text'])
            id_field_values[curr_type] = curr_val

    return id_field_values

def compare_fields(id_field_values, required_field_values):
    for key, val in required_field_values.items():
        if not ((key in id_field_values) and (val.lower() == id_field_values[key].lower())):
            return "The details you provided for " + key + " do not match your ID"
    
    return "Document has been verified"


def main(event, context):
    statusCode = 200 
    isBase64Encoded = True
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers" : "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST"
    }
    body= ''
    
    id_file_name = event["file_name"]
    required_field_values = event["required_field_values"]

    try:
        id_file_values = extract_text(id_file_name)
        body = compare_fields(id_file_values, required_field_values)

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
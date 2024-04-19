import boto3
import json
import os


def compare_faces(id_file_name, selfie_file_name):

    rekognition_client = boto3.client('rekognition')
    
    response = rekognition_client.compare_faces(
        SimilarityThreshold = 95,
        SourceImage = {
            'S3Object': {
                    'Bucket': os.environ['bucketName'],
                    'Name': id_file_name,
                }
        } ,
        TargetImage = {
            'S3Object': {
                    'Bucket': os.environ['bucketName'],
                    'Name': selfie_file_name,
                }
        } ,
    )

    for faceMatch in response['FaceMatches']:
        position = faceMatch['Face']['BoundingBox']
        similarity = str(faceMatch['Similarity'])
        print('The face at ' +
              str(position['Left']) + ' ' +
              str(position['Top']) +
              ' matches with ' + similarity + '% confidence')


    print(response['FaceMatches'])

    return len(response['FaceMatches'])


def main(event, context):
    statusCode = 200 
    isBase64Encoded = True
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers" : "Content-Type",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST"
    }
    
    print(event)
    id_file_name = event["id_file_name"]
    selfie_file_name = event["selfie_file_name"]

    try:
        face_matches = compare_faces(id_file_name, selfie_file_name)
        print("Compared faces:" + str(face_matches))

        if face_matches > 0: 
            body = 'Face match verified'
        else: 
            body = 'No face match found'
            
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
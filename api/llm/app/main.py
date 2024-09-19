from typing import Union
from penny.PennyAgent import PennyAgent
from langchain_community.chat_models import BedrockChat
from fastapi import FastAPI, Request, Response, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import boto3
import json
import requests
import time
import os


#fastapi app init
app = FastAPI()
bedrock = boto3.client(service_name='bedrock-runtime')

origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

config = dict(
    assistant_name="Penny",
    assistant_role="Banking Assistant",
    bank_name="AnyBank",
    conversation_history=[],
    use_tools=True
)
llm = BedrockChat(
        model_id='anthropic.claude-3-5-sonnet-20240620-v1:0', 
        client=bedrock,
        model_kwargs={
            "temperature": 0.5,
            "top_k": 250,
            "top_p": 0.999,
            "stop_sequences": ["\\n\\nHuman:"]
        }
    )


@app.get("/")
def read_root():
    global agent
    agent = PennyAgent.from_llm(llm, verbose=False, **config)
    agent.seed_agent()
    return {"response": "Agent is ready"}

@app.post("/question")
async def question(request: Request) -> Response:
    requestJson = await request.json()
    message = requestJson["message"]
    agent.human_step(message)
    response = agent.step()
    return JSONResponse(content={"message": response})

@app.post("/uploadDoc")
async def id(file: UploadFile = File(...)) -> Response:
    try:
        contents = file.file.read()
        file.file.seek(0)
        s3_client = boto3.client('s3')

        obj_name = "my-doc-" + str(time.time()).replace(".", "") + ".png"
        print("Uploading object with name: " + obj_name)
        response = s3_client.upload_fileobj(file.file, os.environ["idBucketName"], obj_name)
        print(response)

        agent.human_step("[System] uploaded file-name: " + obj_name)
        response = agent.step()
    except Exception as e:
        raise HTTPException(status_code=500, detail='Something went wrong: ' + str(e))
    finally:
        file.file.close()

    return JSONResponse(content={"message": response})

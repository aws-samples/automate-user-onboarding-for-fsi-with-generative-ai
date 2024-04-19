from langchain.tools import BaseTool
from langchain.chains import RetrievalQA
import boto3
import json
from langchain.agents import Tool
from langchain.embeddings.sentence_transformer import SentenceTransformerEmbeddings
from langchain_community.chat_models import BedrockChat
from langchain_community.retrievers import AmazonKendraRetriever
from pydantic import EmailStr, Field
from email_validator import validate_email, EmailNotValidError
import requests
import os

#Bedrock client initialization
bedrock = boto3.client(service_name='bedrock-runtime')
#vector db init
modeled = SentenceTransformerEmbeddings(model_name="all-mpnet-base-v2")

API_ENDPOINT = os.environ["apiEndpoint"]

def setup_knowledge_base():
    """
    We assume that the product knowledge base is simply a text file.
    """
    llm = BedrockChat(
        model_id='anthropic.claude-3-haiku-20240307-v1:0', 
        client=bedrock,
        model_kwargs={
            "temperature": 1,
            "top_k": 250,
            "top_p": 0.999,
            "stop_sequences": ["\\n\\nHuman:", "\\n\\System:"],
            "anthropic_version": "bedrock-2023-05-31"
        }
    )

    retriever = AmazonKendraRetriever(index_id=os.environ["kendraIndexId"])

    knowledge_base = RetrievalQA.from_chain_type(
        llm=llm, chain_type="stuff", retriever=retriever, verbose=True
    )
    return knowledge_base


class product_search(BaseTool):
    name = "ProductSearch"
    description = "Use this tool when you need to give some information about AnyBank or it's products. " \
                    "It takes the the question as input" \
                  "It will return the relevant information for you to answer the question."

    def _run(self, question):
        knowledge_base = setup_knowledge_base()
        response = knowledge_base.run(question)
        return response

    def _arun(self, query: str):
        raise NotImplementedError("This tool does not support async")
    
    
class email_validator(BaseTool):
    name = "EmailValidation"
    description = "Use this tool when email needs to be validated. " \
                  "It will return a sentence whether the email is validated or not."

    def _run(self, query):
        query: EmailStr

        try:
            emailInfo = validate_email(query, check_deliverability=False)
            email = emailInfo.normalized

            url = API_ENDPOINT + '/account'
            params = {'email': email.lower()}
            r = requests.get(url = url, params = params)

            print(r.json())
            if r.json()["statusCode"] != 200:
                return "Respond that our onboarding service is currently unavailable and to try again later."

            return "The email {} is valid. ".format(email) + "If account already exists with this email, ask the user to try again. Current status: " + r.json()["body"] 
            
        except EmailNotValidError as e:
            return "Respond that {} is not valid. Ask the user to try again".format(query)

    def _arun(self, query: str):
        raise NotImplementedError("This tool does not support async")
    
class document_verification(BaseTool):
    name = "IDVerification"
    description = "Use this tool to verify the user ID. " \
                    "It takes the id_file_name, first_name and last_name as inputs." \
                  "It will return a sentence whether the ID is verified or not"

    def _run(self, input=""):
        file_name, first_name, last_name = input.split(",")
        file_name = file_name.replace(" ", "")
        required_field_values = {"FIRST_NAME": first_name.replace(" ", ""), "LAST_NAME": last_name.replace(" ", "")}
        print(required_field_values)

        url = API_ENDPOINT + '/verifyId'
        body = {
            'file_name': file_name,
            'required_field_values': required_field_values
        }
        r = requests.post(url=url, json=body)

        print(r.json())
        if r.json()["statusCode"] != 200:
            return "Respond that our onboarding service is currently unavailable and to try again later."

        print("Post successful")
        return "id_file_name: " + file_name + ". If the document has been verified. ask the user to upload a selfie for face verification. If not, ask them to try again. Current status: " + r.json()["body"] 
        
    def _arun(self, query: str):
        raise NotImplementedError("This tool does not support async")


class selfie_verification(BaseTool):
    name = "SelfieVerification"
    description = "Use this tool to verify the user selfie and compare faces. " \
                    "It takes the id file name and selfie file name as inputs." \
                  "It will return a sentence whether there is a face match"

    def _run(self, input=""):
        id_file_name, selfie_file_name = input.split(",")
        id_file_name = id_file_name.replace(" ", "")
        selfie_file_name = selfie_file_name.replace(" ", "")
        print("Face comparison starting. Id file name is " + id_file_name + "and selfie file name is " + selfie_file_name)

        url = API_ENDPOINT + '/verifyFace'
        body = {
            'id_file_name': id_file_name,
            'selfie_file_name': selfie_file_name
        }
        r = requests.post(url=url, json=body)

        if r.json()["statusCode"] != 200:
            return "Respond that our onboarding service is currently unavailable and to try again later."

        print(r.json())
        return "If the face has been verified, ask the user to confirm they want to proceed. If not verified, ask them to try again. Current status: " + r.json()["body"]
        
    def _arun(self, query: str):
        raise NotImplementedError("This tool does not support async")
    

class ask_question(BaseTool):
    name = "AskUser"
    description = "Use this tool to ask something to the user. " \
                    "It takes the question you want to ask as the input" \
                  "It will return a question that you can ask"

    def _run(self, question):
        return "ask user " + question

    def _arun(self, query: str):
        raise NotImplementedError("This tool does not support async")
    
class finish_onboarding(BaseTool):
    name = "SaveData"
    description = "Use this tool when you need save user data. " \
                    "It takes the email, account_type (CHEQUING or SAVINGS), first_name, last_name, id_file_name, selfie_file name as inputs as a single string comma separated." \
                  "It will return a sentence whether the onboarding successfully or not."

    def _run(self, input=""):
        email, account_type, first_name, last_name, id_file_name, selfie_file_name = input.replace(" ", "").split(",")

        url = API_ENDPOINT + '/account'
        body = {
            'email': email,
            'account_type': account_type,
            'first_name': first_name,
            'last_name': last_name,
            'id_file_name': id_file_name,
            'selfie_file_name': selfie_file_name
        }
        print(body)
        r = requests.post(url=url, json=body)
        print(r)

        if r.status_code != 200:
            return "Something went wrong with creating an account. Please try again later."

        return "Inform user of the status. Current status: " + r.json()["body"]

    def _arun(self, query: str):
        raise NotImplementedError("This tool does not support async")


def get_tools():
    # query to get_tools can be used to be embedded and relevant tools found
    # see here: https://langchain-langchain.vercel.app/docs/use_cases/agents/custom_agent_with_plugin_retrieval#tool-retriever

    # we only use one tool for now, but this is highly extensible!
    knowledge_base = setup_knowledge_base()
    tools = [
        Tool(
            name="ProductSearch",
            func=knowledge_base.run,
            description="useful for when you need to answer any question",
        ),
        #product_search
        email_validator(),
        ask_question(),
        document_verification(),
        selfie_verification(),
        finish_onboarding()
    ]

    return tools
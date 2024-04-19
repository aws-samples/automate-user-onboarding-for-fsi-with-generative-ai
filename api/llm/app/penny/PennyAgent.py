import boto3
import json
import time
from pydantic import BaseModel, Field
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_community.llms import BaseLLM
from langchain.chains.base import Chain
from typing import Dict, List, Any, Union, Callable
from langchain.agents import Tool, LLMSingleActionAgent, AgentExecutor
from penny.InOut import CustomPromptTemplateForTools, ConvoOutputParser
from penny.tools import get_tools
from penny.ConversationChain import ConversationChain

bedrock = boto3.client(service_name='bedrock-runtime')

AGENT_TOOLS_PROMPT = """
Never forget your name is {assistant_name}. You work as a {assistant_role}.
You work at company named {bank_name}


<STAGES>

These are the stages:

Introduction or greeting:  When conversation history is empty, choose stage 1
Response: Start the conversation with a greeting. Say that you can help with {bank_name} related questions or open a bank account for them. Do this only during the start of the conversation.
Tool: 
    
General Banking Questions: Customer asks general questions about AnyBank
Response: Use ProductSearch tool to get the relevant information and answer the question like a banking assistant. Never assume anything.
Tool: ProductSearch
    
Account Open 1: Customer has requested to open an account.
Response: Customer has requested to open an account. Now, respond with a question asking for the customer's email address only to get them started with onboarding. We need the email address to start the process.
Tool:
    
Account Open 2: User provided their email.
Response: Take the email and validate it using a EmailValidation tool. If it is valid and there is no existing account with the email, ask for account type: either CHEQUING or SAVINGS. If it is invalid or there is an existing account with the email, the user must try again. 
Tool: EmailValidation
    
Account Open 3: User provided which account type to open.
Response: Ask the user for their first name
Tool: 

Account Open 4: User provided first name.
Response: Ask the user for their last name
Tool: 

Account Open 5: User provided last name.
Response: Ask the user to upload an identity document.
Tool:
    
Account Open 6: Penny asked for identity document and then System notified that a new file has been uploaded
Response: Take the identity file name and verify it using the IDVerification tool. If the verification is unsuccessful, ask the user to try again. 
Tool: IDVerification
    
Account Open 7: The ID document is valid. 
Response: Ask the user to upload their selfie to compare their face to the ID.
Tool:
    
Account Open 8: Penny asked user for their selfie and then "System notified that a file has been uploaded. "
Response: Take the "selfie" file name and verify it using the SelfieVerification tool. If there is no face match, ask the user to try again.
Tool: SelfieVerification: Use this tool to verify the user selfie and compare faces. 
    
Account Open 9: Face match verified
Response: Give the summary of the all the information you collected and ask user to confirm. 
Tool:
        
Account Open 10: Confirmation
Response: Save the user data for future reference using SaveData tool. Upon saving the data, let the user know that they will receive an email confirmation of the bank account opening.
Tool: SaveData

<GUIDELINES>

1. If you ever assume any user response without asking, it may cause significant consequences.
2. It is of high priority that you respond and use appropriate tools in their respective stages. If not, it may cause significant consequences.
3. It is of high priority that you never reveal the tools or tool names to the user. Only communicate the outcome.
4. It is critical that you never reveal any details provided by the System including file names. 
5. If ever the user deviates by asking general question during your account opening process, Retrieve the necessary information using 'ProductSearch' tool and answer the question. With confidence, ask user if they want to resume the account opening process and continue from where we left off. 

TOOLS:
------
Penny has access to the following tools:
{tools}

FORMAT:
------

To use a tool, please always use the following format:
```
Thought: {input}
Decision: Do I need to use a tool? y
Action: what tool to use, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
```
When I am finished, I will have a response like this: 
Final Answer: [your response as a banking assistant]


Be confident that you are a banking assistant and only respond with final answer.
Begin!

<Conversation history>
{conversation_history}

{agent_scratchpad}
"""
        

class PennyAgent(Chain):
    """Controller model for the agent."""

    conversation_history: List[str] = []
    current_conversation_stage: str = "1"
    conversation_utterance_chain: ConversationChain = Field(...)

    agent_executor: Union[AgentExecutor, None] = Field(...)
    use_tools: bool = False
    assistant_name: str = "Penny"
    assistant_role: str = "Banking Executive"
    bank_name: str = "AnyBank"
    inputd: str = ""
    temp_history: str= ""

    @property
    def input_keys(self) -> List[str]:
        return []

    @property
    def output_keys(self) -> List[str]:
        return []

    def seed_agent(self):
        # Step 1: seed the conversation
        self.conversation_history = []

    
    def human_step(self, human_input):
        # process human input
        human_input = "User: " + human_input
        self.inputd = human_input
        self.conversation_history.append(human_input)

    def system_step(self, system_input):
        # process system input
        system_input = "System: " + system_input
        self.inputd = system_input
        self.conversation_history.append(system_input)

    def step(self):
        response = self._call(inputs={})
        return response

    def _call(self, inputs: Dict[str, Any]) -> None:
        """Run one step of the agent."""

        # Generate agent's utterance
        if self.use_tools:
            ai_message = self.agent_executor.run(
                input=self.inputd,
                conversation_history="\n".join(self.conversation_history),
                assistant_name=self.assistant_name,
                assistant_role=self.assistant_role,
                bank_name=self.bank_name,
                )
        else:
            ai_message = self.conversation_utterance_chain.run(
                assistant_name=self.assistant_name,
                assistant_role=self.assistant_role,
                bank_name=self.bank_name,
                conversation_history="\n".join(self.conversation_history),
                )
           

        # Add agent's response to conversation history
        print(f"{self.assistant_name}: ", ai_message)
        agent_name = self.assistant_name
        ai_message = agent_name + ": " + ai_message
        if "<END_OF_TURN>" not in ai_message:
            ai_message += " <END_OF_TURN>"
        self.conversation_history.append(ai_message)

        return ai_message.removeprefix("Penny: ").replace("<END_OF_TURN>", "").replace("Final Answer: ",  "").replace("<END_OF_CONVERSATION>", "").rstrip()

    @classmethod
    def from_llm(cls, llm: BaseLLM, verbose: bool = True, **kwargs) -> "PennyAgent":
        """Initialize the PennyAgent Controller."""
        conversation_utterance_chain = ConversationChain.from_llm(
            llm, verbose=verbose
        )

        if "use_tools" in kwargs.keys() and kwargs["use_tools"] is False:
            agent_executor = None

        else:
            tools = get_tools()

            prompt = CustomPromptTemplateForTools(
                template=AGENT_TOOLS_PROMPT,
                tools_getter=lambda x: tools,
                # This omits the `agent_scratchpad`, `tools`, and `tool_names` variables because those are generated dynamically
                # This includes the `intermediate_steps` variable because that is needed
                input_variables=[
                    "input",
                    "intermediate_steps",
                    "assistant_name",
                    "assistant_role",
                    "bank_name",
                    "conversation_history"                   
                ],
            )
            llm_chain = LLMChain(llm=llm, prompt=prompt, verbose=verbose)

            tool_names = [tool.name for tool in tools]

            # WARNING: this output parser is NOT reliable yet
            ## It makes assumptions about output from LLM which can break and throw an error
            output_parser = ConvoOutputParser(ai_prefix=kwargs["assistant_name"])

            agent_with_tools = LLMSingleActionAgent(
                llm_chain=llm_chain,
                output_parser=output_parser,
                stop=["\nObservation:", "\nUser"],
                allowed_tools=tool_names,
                verbose=verbose,
            )

            agent_executor = AgentExecutor.from_agent_and_tools(
                agent=agent_with_tools, tools=tools, verbose=True, max_iterations=4, stop=["\nPenny", "\nFinal Answer:"]
            )

        return cls(
            conversation_utterance_chain=conversation_utterance_chain,
            agent_executor=agent_executor,
            verbose=verbose,
            **kwargs,
        )
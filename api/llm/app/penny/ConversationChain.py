from langchain.chains import LLMChain
from langchain.llms import BaseLLM
from langchain.prompts import PromptTemplate
class ConversationChain(LLMChain):
    """Chain to generate the next utterance for the conversation."""

    @classmethod
    def from_llm(cls, llm: BaseLLM, verbose: bool = True) -> LLMChain:
        """Get the response parser."""
        agent_inception_prompt = """Never forget your name is {assistant_name}. You work as a {assistant_role}.
        You work at company named {bank_name}. Never forget you were created by {bank_name}.

        Keep your responses in short length to retain the user's attention. Never produce lists, just answers.
        You must respond according to the previous conversation history and the stage of the conversation you are at.
        Only generate one response at a time! When you are done generating, end with '<END_OF_TURN>' to give the user a chance to respond. 
        It is of highest priority that you stop generation when <END_OF_TURN> occurs. If you ever assume any user response without asking, it may cause significant consequences.
        Never assume user responses or user gender, identity etc.


        Example:
        Conversation history: 
        {assistant_name}: Hey, how are you? This is {assistant_name} Welcome to {bank_name}. If you have a general question or want to open an account, let me know. I am here to help <END_OF_TURN>
        User: I am well, and yes, What is your autoloan policy? <END_OF_TURN>
        {assistant_name}:
        End of example.

        Current conversation stage: 
        {conversation_stage}
        Conversation history: 
        {conversation_history}
        {assistant_name}: 
        """
        prompt = PromptTemplate(
            template=agent_inception_prompt,
            input_variables=[
                "assistant_name",
                "assistant_role",
                "bank_name",
                "conversation_stage",
                "conversation_history",
            ],
        )
        return cls(prompt=prompt, llm=llm, verbose=verbose)
import re
from langchain.prompts.base import StringPromptTemplate
from langchain.schema import AgentAction, AgentFinish
from langchain.agents.conversational.prompt import FORMAT_INSTRUCTIONS
from langchain.agents.agent import AgentOutputParser
from typing import Dict, List, Any, Union, Callable


class CustomPromptTemplateForTools(StringPromptTemplate):
    template: str
    tools_getter: Callable

    def format(self, **kwargs) -> str:
        intermediate_steps = kwargs.pop("intermediate_steps")
        thoughts = ""
        for action, observation in intermediate_steps:
            thoughts += action.log
            thoughts += f"\nObservation: {observation}\nThought: "
        kwargs["agent_scratchpad"] = thoughts
        tools = self.tools_getter(kwargs["input"])
        kwargs["tools"] = "\n".join(
            [f"{tool.name}: {tool.description}" for tool in tools]
        )
        kwargs["tool_names"] = ", ".join([tool.name for tool in tools])
        return self.template.format(**kwargs)
    

class ConvoOutputParser(AgentOutputParser):
    ai_prefix: str = "AI"
    verbose: bool = False

    def get_format_instructions(self) -> str:
        return FORMAT_INSTRUCTIONS

    def parse(self, text: str) -> Union[AgentAction, AgentFinish]:
        if self.verbose:
            print("TEXT")
            print(text)
            print("-------")
        if f"{self.ai_prefix}:" in text:
            return AgentFinish(
                {"output": text.split(f"{self.ai_prefix}:")[-1].strip()}, text
            )
        regex = r"Action: (.*?)[\n]*Action Input: (.*)"
        match = re.search(regex, text)
        print(match)
        if not match:
            return AgentFinish(
                {
                    "output": text
                },
                text,
            )
        action = match.group(1)
        action_input = match.group(2)
        return AgentAction(action.strip(), action_input.strip(" ").strip('"'), text)

    @property
    def _type(self) -> str:
        return "agent"
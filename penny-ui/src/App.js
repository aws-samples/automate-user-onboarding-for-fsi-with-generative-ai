import './App.css';
import * as React from 'react';
import ChatPopup from './components/chatPopup';
import PageBody from './components/pageBody';

// Fill with `CloudFrontDomainName` value outputted by your CloudFormation Stack 
// Eg. const LLM_API_ENDPOINT = 'https://1234example.cloudfront.net/' (make sure to add back slash at the end)
const LLM_API_ENDPOINT = 'https://<your-cloudfront-domain>/'   

// Uncomment below for local development
// const LLM_API_ENDPOINT = 'http://127.0.0.1:8000/'

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      chats: []
    }
  }
  componentDidMount() {
    const request = {
        method: 'GET',
    }

    fetch(LLM_API_ENDPOINT, request)
    .then(response => response.json())
    .then(data => console.log("GET Agent Call successful"))
    .catch(error => console.log('Error:', error));
  }

  handleAddChat = (newChat) => {
    this.setState(prevState => ({
      chats: [...prevState.chats, newChat],
      inputValue: '',
    }));
  }


  render() {
    return (
      <div className="App">
        <ChatPopup
          llmApiEndpoint={LLM_API_ENDPOINT}
          chats={this.state.chats}
          handleAddChat={this.handleAddChat}
        />
        <PageBody
          activateOverlay={this.state.showChat}
        ></PageBody>
      </div>
    );
  }
}

export default App;


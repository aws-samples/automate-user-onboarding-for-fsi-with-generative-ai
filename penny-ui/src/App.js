import './App.css';
import * as React from 'react';
import ChatPopup from './components/chatPopup';
import PageBody from './components/pageBody';

// Enter ECS public endpoint here (make sure to add back slash at the end)
// const LLM_API_ENDPOINT = 'http://127.0.0.1:8000/'
const LLM_API_ENDPOINT = 'http://<public-ip>/'

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


import * as React from 'react';
import ChatPopupBody from './chatPopupBody';

class ChatPopup extends React.Component  {

    render() {
        return (
            <div className="overlay">
                <div
                    style={{
                            position: 'fixed',
                            height: '75%',
                            width: '75%',
                            opacity: 1,
                            right: '10%',
                            bottom: '14%',
                            marginTop: '10%',
                    }}
                >
                    <ChatPopupBody 
                        llmApiEndpoint={this.props.llmApiEndpoint}
                        chats={this.props.chats}
                        handleAddChat={this.props.handleAddChat}
                    />
                </div>
            </div>
        )
    }
}

export default ChatPopup;

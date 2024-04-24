import * as React from 'react';
import Box from '@mui/material/Box';
import { Button, InputAdornment } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PushPin from '@mui/icons-material/PushPin';
import Typography from '@mui/material/Typography';
import AssistantIcon from '@mui/icons-material/Assistant';
import PersonIcon from '@mui/icons-material/Person';
import TextField from '@mui/material/TextField';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SendIcon from '@mui/icons-material/Send';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import Chip from '@mui/material/Chip';

class ChatPopupBody extends React.Component  {

    constructor(props) {
        super(props);

        this.state = {
            chats: this.props.chats,
            inputValue: '',
            file: null
        }
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleEnterPress = this.handleEnterPress.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.scrollableDivRef = React.createRef();
        this.handleBackButton = this.handleBackButton.bind(this);
        this.handleCustomerChat = this.handleCustomerChat.bind(this)
        this.handleSelectFile = this.handleSelectFile.bind(this)
    }

    handleBackButton(event) {
        window.location.reload();
    }

    componentDidUpdate(prevProps, prevState) {
        if( prevState.chats.length < this.state.chats.length) {
            const scrollableDiv = this.scrollableDivRef.current;
            scrollableDiv.scrollTop = scrollableDiv.scrollHeight;
        }
    }

    handleSearch() {
        this.handleCustomerChat(this.state.inputValue);
    }
    handleEnterPress(event) {
        if( event.key === 'Enter') {
            this.handleCustomerChat(this.state.inputValue);
            
        }
    }

    handleInputChange(event) {
        this.setState({inputValue: event.target.value});
    }

    handleCustomerChat(input) {
        let newCustomerChat = {
            user: 'Customer',
            message: input
        }

        this.setState(prevState => ({
            chats: [...prevState.chats, newCustomerChat],
            inputValue: '',
        }));

        this.props.handleAddChat(newCustomerChat)

        const requestBody = JSON.stringify({ "message": input })    
            const request = {
                method: 'POST',
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: requestBody
            };

        let waitPennyChat = {
                user: 'Penny',
                message: "Penny is typing...",
        }

        this.setState(prevState => ({
                chats: [...prevState.chats, waitPennyChat],
                inputValue: '',
        }));
        fetch(this.props.llmApiEndpoint + 'question', request)
        .then(response => response.json())
        .then(data => {
                console.log("POST Agent Call successful: " + JSON.stringify(data.message))

                let newPennyChat = {
                    user: 'Penny',
                    message: data.message,
                }

                let chats = [...this.state.chats];
                chats.pop();
                chats.push(newPennyChat);

                this.setState({
                    chats: chats,
                    inputValue: '',
                });

                this.props.handleAddChat(newPennyChat)
            })
        .catch(error => console.log('Error:', error));
            
    }

    handleSelectFile(event) {
        this.setState({file: event.target.files[0]});
        console.log("Uploading file");

        console.log(event.target.files[0]);

        var formData = new FormData()
        formData.append("file", event.target.files[0]);

        const request = {
            method: 'POST',
            headers: { 
                'Accept': 'application/json',
            },
            body: formData
        };

        console.log(request);

        var url = ""

        url = this.props.llmApiEndpoint + 'uploadId'

        let docPennyChat = {
            user: 'Penny',
            message: "We have received your document. Please wait while we complete the verification.",
        }

        this.setState(prevState => ({
            chats: [...prevState.chats, docPennyChat],
            inputValue: '',
        }));

        fetch(url, request)
        .then(response => response.json())
        .then(data => {
            console.log("data" + JSON.stringify(data))
            console.log("POST Agent Call successful: " + JSON.stringify(data.message))

            var docRespPennyChat = ''

            if( data.detail) {
                docRespPennyChat = {
                    user: 'Penny',
                    message: data.detail + " while uploading the file. Please try again",
                }
            }
            else {
                docRespPennyChat = {
                    user: 'Penny',
                    message: data.message,
                }
            }

            let chats = [...this.state.chats];
            chats.push(docRespPennyChat);

            this.setState({
                    chats: chats,
                    inputValue: '',
            });

            this.props.handleAddChat(docRespPennyChat)
        })
        .catch(error => {
            console.log('Error:', error)
        });

        // reset the file upload button
        document.getElementById("uploadFile").value = '';

    }

    render() {
        return (

            <Box sx={{
                border: 'solid #CECECE',
                borderRadius: '15px',
                borderWidth: '1.5px',
                width: '100%',
                height: '100%',
                backgroundColor: 'white',
                textAlign: 'center',
                position: 'relative'
            }}>
                <div className='topBar' style={{
                    display: 'flex',
                    margin: 'auto',
                    marginRight: '0px',
                    justifyContent: 'space-between',
                    maxHeight: '5%',
                    flex: '1'
                }}>

                    <Button 
                        disableRipple
                        sx={{
                            margin: '5px',
                            borderRadius: '10px',
                            minWidth: 0,
                            padding: '3px',
                            backgroundColor: '#e0e0e0',
                            '&:hover': {
                                backgroundColor: '#CECECE',
                            },
                        }}
                    >
                        <Box sx={{ 
                            height: '100%',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                        }}>
                        <PushPin sx={{
                                fill: '#000000',
                                height: '15px'
                            }}/>

                        <Typography sx={{
                            textTransform: 'none',
                            color: '#000000',
                            fontSize: 12,
                            marginRight: '5px'
                        }}>Pin</Typography>
                        </Box>
                    </Button>
                    <Button
                        disableRipple
                        sx={{
                            margin: '5px',
                            borderRadius: '10px',
                            backgroundColor: '#e0e0e0',
                            padding: '5px',
                            '&:hover': {
                                backgroundColor: '#CECECE',
                            },
                        }}
                        onClick={this.handleBackButton}
                    >
                        <Box sx={{ 
                            height: '100%',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                        }}>
                            <CloseIcon sx={{
                                fill: '#000000',
                                height: '15px'
                            }}/>
                        </Box>
                        <Typography sx={{
                            textTransform: 'none',
                            color: '#000000',
                            fontSize: 12,
                            marginRight: '5px'
                        }}>Close</Typography>

                    </Button>
                    
                    
                </div>

                <div className='chat-body' ref={this.scrollableDivRef} style={{
                    maxHeight: '85%',
                    margin: '10px',
                    overflowY: 'scroll',
                    position: 'relative',
                    flex: 2
                }}>

                        <Box sx={{
                            margin: '20px',
                            padding: '5px',
                            display: 'flex',
                            color: 'black',
                            paddingBottom: '25px',
                            justifyContent: 'center',
                        }}>
                            <Chip icon={<SentimentSatisfiedAltIcon />} label="Start talking to Amazon Penny" />
                
                        </Box>

                    {this.state.chats.map((chat, index) => (
                        <Box sx={{
                            margin: '20px',
                            padding: '5px',
                            display: 'flex',
                            color: 'black',
                            paddingBottom: '25px',
                            borderBottom: 'solid 1px #e0e0e0',
                        }}>
                            {chat.user === 'Penny' ? 
                                <AssistantIcon></AssistantIcon> : 
                                <PersonIcon></PersonIcon>
                            }
                            <Typography sx={{
                                textAlign: 'left',
                                marginLeft: '20px',
                                whiteSpace: 'pre-line'
                            }}>{chat.message}</Typography>
                        </Box>
                    ))}

                </div> 

                <Box    
                    sx={{
                        maxWidth: '100%',
                        display: 'flex',
                        position: 'absolute',
                        left: 0,
                        bottom: 0,
                        width: 'inherit',
                        flex: 3
                    }}
                    >
                    <div className="file-upload" style={{
                        top: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <AttachFileIcon fontSize="large" style={{ cursor: 'pointer' }}></AttachFileIcon>
                        <input type="file" name='file' id='uploadFile' accept="image/png,image/jpeg,image/jpg,application/pdf"
                        onChange={this.handleSelectFile}/>    
                    </div>

                    <TextField fullWidth sx={{
                            borderRadius: '15px',
                            padding: '5px',
                            '& input': {
                                color: 'black',
                                height: '10px'
                            }
                        }}
                        type="text"
                        label="Message Penny..."
                        onKeyDown = {this.handleEnterPress}
                        value={this.state.inputValue}
                        onChange={this.handleInputChange}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <SendIcon style={{ cursor: 'pointer' }} onClick={this.handleSearch}/>
                                </InputAdornment>
                            )
                        }}

                        />
                </Box>
                
            </Box>


        );
    }
}

export default ChatPopupBody;

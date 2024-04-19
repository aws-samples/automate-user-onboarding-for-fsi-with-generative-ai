import * as React from 'react';

class PageBody extends React.Component  {

    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div style={{
                height: '100vh',
                overflow: 'hidden',
                backgroundColor: 'white',
                zIndex: 0,
            }}>

            </div>
        )
    }
}

export default PageBody;

 
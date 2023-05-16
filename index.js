const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.locals.pretty = true;

app.set('view engine', 'pug');

//Handles the routes dealing with the home page.
app.use('/', require('./Routes/root'));

app.listen(8080, () => {
    console.log('Server is running on port 8080')
});